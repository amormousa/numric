#include "bisection.h"
#include "../include/expr_eval.h"
#include <cmath>
#include <limits>
#include <sstream>

using namespace expr;

static double safe_eval(Expression &e, double x) {
    try {
        return e.eval(x);
    } catch (...) {
        return std::numeric_limits<double>::quiet_NaN();
    }
}

BisectionResult bisection_method_expr(const std::string &expression, double a, double b, double tol, int max_iter, bool use_false_position) {
    BisectionResult res;
    Expression e(expression);

    double f_a = safe_eval(e, a);
    double f_b = safe_eval(e, b);
    if (!std::isfinite(f_a) || !std::isfinite(f_b)) {
        res.converged = false; res.message = "f(a) or f(b) is not finite"; return res;
    }
    if (f_a * f_b >= 0) { res.converged = false; std::ostringstream ss; ss<<"Invalid interval"; res.message = ss.str(); return res; }

    double xr_old = std::numeric_limits<double>::quiet_NaN();
    for (int iteration = 1; iteration <= max_iter; ++iteration) {
        double xr;
        if (!use_false_position) xr = 0.5*(a+b);
        else {
            double f_a_local = safe_eval(e,a), f_b_local = safe_eval(e,b);
            double denom = f_a_local - f_b_local;
            if (std::abs(denom) < std::numeric_limits<double>::epsilon()) { res.converged=false; res.message="Denominator too small"; return res; }
            xr = b - (f_b_local*(a-b))/denom;
        }
        double f_xr = safe_eval(e,xr);
        double error = std::numeric_limits<double>::quiet_NaN();
        if (std::isfinite(xr_old)) { double denom = (std::abs(xr)>std::numeric_limits<double>::epsilon())?std::abs(xr):1.0; error = std::abs((xr-xr_old)/denom)*100.0; }

        IterationRow row{iteration,a,b,xr,f_xr,std::isfinite(error)?error:std::numeric_limits<double>::quiet_NaN()};
        res.rows.push_back(row);

        if (!std::isfinite(f_xr)) { res.converged=false; res.message="f(xr) not finite"; return res; }
        if (f_xr==0.0) { res.converged=true; res.message="Exact root"; return res; }
        if (safe_eval(e,a)*f_xr < 0) b = xr; else a = xr;
        if (std::isfinite(error) && error <= tol) { res.converged=true; res.message="Converged"; return res; }
        xr_old = xr;
    }
    res.converged=false; res.message="Max iterations reached"; return res;
}

BisectionResult newton_method_expr(const std::string &expression, double x0, double tol, int max_iter) {
    BisectionResult res; Expression e(expression);
    double h=1e-6; double x=x0;
    for (int iteration=1; iteration<=max_iter; ++iteration){
        double fx = safe_eval(e,x);
        double fpx = (safe_eval(e,x+h)-safe_eval(e,x-h))/(2.0*h);
        IterationRow row{iteration,x,x,x,fx,std::numeric_limits<double>::quiet_NaN()};
        res.rows.push_back(row);
        if (!std::isfinite(fx) || !std::isfinite(fpx)) { res.converged=false; res.message="Non-finite"; return res; }
        if (std::abs(fpx) < 1e-15) { res.converged=false; res.message="Derivative too small"; return res; }
        double x_new = x - fx/fpx;
        double err = std::abs((x_new-x)/(std::abs(x_new)>0?std::abs(x_new):1.0))*100.0;
        if (err <= tol) { IterationRow finalRow{iteration+1,x_new,x_new,x_new,safe_eval(e,x_new),err}; res.rows.push_back(finalRow); res.converged=true; res.message="Converged"; return res; }
        x = x_new;
    }
    res.converged=false; res.message="Max iterations reached"; return res;
}

BisectionResult secant_method_expr(const std::string &expression, double x0, double x1, double tol, int max_iter) {
    BisectionResult res; Expression e(expression);

    double x_prev = x0;
    double x_curr = x1;

    double f_prev = safe_eval(e, x_prev);
    double f_curr = safe_eval(e, x_curr);

    if (!std::isfinite(f_prev) || !std::isfinite(f_curr)) { res.converged=false; res.message="Initial evaluations not finite"; return res; }

    for (int iteration = 1; iteration <= max_iter; ++iteration) {
        if (std::abs(f_curr - f_prev) < std::numeric_limits<double>::epsilon()) {
            res.converged = false; res.message = "Denominator too small"; return res;
        }

        double x_next = x_curr - f_curr * (x_prev - x_curr) / (f_prev - f_curr);
        double f_next = safe_eval(e, x_next);

        double error = std::numeric_limits<double>::quiet_NaN();
        if (std::isfinite(x_curr)) {
            double denom = (std::abs(x_curr) > std::numeric_limits<double>::epsilon()) ? std::abs(x_curr) : 1.0;
            error = std::abs((x_next - x_curr) / denom) * 100.0;
        }

        IterationRow row{iteration, x_prev, x_curr, x_next, f_next, std::isfinite(error) ? error : std::numeric_limits<double>::quiet_NaN()};
        res.rows.push_back(row);

        if (!std::isfinite(f_next)) { res.converged=false; res.message="f(x) not finite"; return res; }
        if (std::abs(f_next) == 0.0) { res.converged=true; res.message="Exact root"; return res; }
        if (std::isfinite(error) && error <= tol) { res.converged=true; res.message="Converged"; return res; }

        x_prev = x_curr; f_prev = f_curr;
        x_curr = x_next; f_curr = f_next;
    }

    res.converged = false;
    res.message = "Max iterations reached";
    return res;
}

BisectionResult fixed_point_method_expr(const std::string &expression_g, double x0, double tol, int max_iter) {
    BisectionResult res;
    Expression g(expression_g);

    double x = x0;
    for (int iteration = 1; iteration <= max_iter; ++iteration) {
        double x_next = safe_eval(g, x);
        double f_xnext = std::numeric_limits<double>::quiet_NaN();

        // For fixed-point we can set fxr as g(x) - x to indicate f(x) = g(x)-x root
        if (std::isfinite(x_next)) {
            f_xnext = x_next - x; // not strictly f(xr) but indicates change
        }

        double error = std::numeric_limits<double>::quiet_NaN();
        if (std::isfinite(x_next)) {
            double denom = (std::abs(x_next) > std::numeric_limits<double>::epsilon()) ? std::abs(x_next) : 1.0;
            error = std::abs((x_next - x) / denom) * 100.0;
        }

        IterationRow row{iteration, x, x, x_next, std::isfinite(f_xnext) ? f_xnext : std::numeric_limits<double>::quiet_NaN(), std::isfinite(error) ? error : std::numeric_limits<double>::quiet_NaN()};
        res.rows.push_back(row);

        if (!std::isfinite(x_next)) {
            res.converged = false;
            res.message = "Non-finite g(x)";
            return res;
        }

        if (std::isfinite(error) && error <= tol) {
            res.converged = true;
            res.message = "Converged";
            return res;
        }

        x = x_next;
    }

    res.converged = false;
    res.message = "Max iterations reached";
    return res;
}
