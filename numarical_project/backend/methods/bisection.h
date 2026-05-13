#pragma once

#include <string>
#include <vector>

struct IterationRow {
    int iteration;
    double xl;
    double xu;
    double xr;
    double fxr;
    // error as percentage or null represented with NAN
    double error;
};

struct BisectionResult {
    std::vector<IterationRow> rows;
    bool converged;
    std::string message;
};

// Solve using an expression string (e.g. "x^3 - x - 2")
BisectionResult bisection_method_expr(const std::string &expression, double a, double b, double tol, int max_iter, bool use_false_position=false);

// Newton method (numeric derivative)
BisectionResult newton_method_expr(const std::string &expression, double x0, double tol, int max_iter);

// Secant method (requires two initial guesses x0, x1)
BisectionResult secant_method_expr(const std::string &expression, double x0, double x1, double tol, int max_iter);

// Fixed-point iteration: `expression` is g(x), iterate x_{n+1} = g(x_n)
BisectionResult fixed_point_method_expr(const std::string &expression_g, double x0, double tol, int max_iter);

