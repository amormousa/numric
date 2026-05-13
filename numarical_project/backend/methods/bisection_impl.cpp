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
        res.converged = false;
        res.message = "f(a) or f(b) is not finite";
        return res;
    }

    if (f_a * f_b >= 0) {
        res.converged = false;
        std::ostringstream ss; ss << "Invalid interval: f(a) * f(b) >= 0 (" << f_a << " * " << f_b << ")";
        res.message = ss.str();
        return res;
    }

    double xr_old = std::numeric_limits<double>::quiet_NaN();

    for (int iteration = 1; iteration <= max_iter; ++iteration) {
        double xr;
        if (!use_false_position) {
            xr = 0.5 * (a + b);
        } else {
            double f_a_local = safe_eval(e, a);
            double f_b_local = safe_eval(e, b);
            double denom = (f_a_local - f_b_local);
            if (std::abs(denom) < std::numeric_limits<double>::epsilon()) {
                res.converged = false;
                res.message = "Denominator too small in false-position formula";
                return res;
            }
            xr = b - (f_b_local * (a - b)) / denom;
        }

        double f_xr = safe_eval(e, xr);

        double error = std::numeric_limits<double>::quiet_NaN();
        if (std::isfinite(xr_old)) {
            double denom = (std::abs(xr) > std::numeric_limits<double>::epsilon()) ? std::abs(xr) : 1.0;
            error = std::abs((xr - xr_old) / denom) * 100.0;
        }

        IterationRow row;
        row.iteration = iteration;
        row.xl = a;
        row.xu = b;
        row.xr = xr;
        row.fxr = f_xr;
        row.error = std::isfinite(error) ? error : std::numeric_limits<double>::quiet_NaN();

        res.rows.push_back(row);

        if (!std::isfinite(f_xr)) {
            res.converged = false;
            res.message = "f(xr) is not finite";
            return res;
        }

        if (f_xr == 0.0) {
            res.converged = true;
            res.message = "Exact root found";
            return res;
        }

        if (safe_eval(e, a) * f_xr < 0) {
            b = xr;
        } else {
            a = xr;
        }

        if (std::isfinite(error) && error <= tol) {
            res.converged = true;
            res.message = "Converged by tolerance";
            return res;
        }

        xr_old = xr;
    }

    res.converged = false;
    res.message = "Maximum iterations reached";
    return res;
}

BisectionResult newton_method_expr(const std::string &expression, double x0, double tol, int max_iter) {
    BisectionResult res;
    Expression e(expression);

    double h = 1e-6;
    double x = x0;

    for (int iteration = 1; iteration <= max_iter; ++iteration) {
        double fx = safe_eval(e, x);
        double fpx = (safe_eval(e, x + h) - safe_eval(e, x - h)) / (2.0 * h);

        IterationRow row;
        row.iteration = iteration;
        row.xl = x;
        row.xu = x;
        row.xr = x;
        row.fxr = fx;
        row.error = std::numeric_limits<double>::quiet_NaN();

        res.rows.push_back(row);

        if (!std::isfinite(fx) || !std::isfinite(fpx)) {
            res.converged = false;
            res.message = "Non-finite f(x) or f'(x)";
            return res;
        }

        if (std::abs(fpx) < 1e-15) {
            res.converged = false;
            res.message = "Derivative too small";
            return res;
        }

        double x_new = x - fx / fpx;
        double err = std::abs((x_new - x) / (std::abs(x_new) > 0 ? std::abs(x_new) : 1.0)) * 100.0;

        if (err <= tol) {
            IterationRow finalRow;
            finalRow.iteration = iteration + 1;
            finalRow.xl = x_new; finalRow.xu = x_new; finalRow.xr = x_new;
            finalRow.fxr = safe_eval(e, x_new);
            finalRow.error = err;
            res.rows.push_back(finalRow);
            res.converged = true;
            res.message = "Converged by tolerance";
            return res;
        }

        x = x_new;
    }

    res.converged = false;
    res.message = "Maximum iterations reached";
    return res;
}
