#include <crow.h>
#include "methods/bisection.h"
#include <nlohmann/json.hpp>
#include <iostream>
#include <cmath>

using json = nlohmann::json;

// =========================
// CORS Middleware
// =========================
struct CORS {

    struct context {};

    void before_handle(
        crow::request& req,
        crow::response& res,
        context&
    ) {

        res.set_header("Access-Control-Allow-Origin", "*");

        res.set_header(
            "Access-Control-Allow-Methods",
            "POST, GET, OPTIONS"
        );

        res.set_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        );

        // Handle preflight requests
        if (req.method == crow::HTTPMethod::Options) {

            res.code = 200;
            res.end();
        }
    }

    void after_handle(
        crow::request&,
        crow::response& res,
        context&
    ) {

        res.set_header("Access-Control-Allow-Origin", "*");

        res.set_header(
            "Access-Control-Allow-Methods",
            "POST, GET, OPTIONS"
        );

        res.set_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        );
    }
};

// =========================
// Helper Functions
// =========================
json convert_rows(const BisectionResult& result) {

    json rows = json::array();

    for (const auto& row : result.rows) {

        json jr;

        jr["iteration"] = row.iteration;
        jr["xl"] = row.xl;
        jr["xu"] = row.xu;
        jr["xr"] = row.xr;
        jr["fxr"] = row.fxr;

        if (std::isfinite(row.error))
            jr["error"] = row.error;
        else
            jr["error"] = nullptr;

        rows.push_back(jr);
    }

    return rows;
}

// =========================
// Main
// =========================
int main(int argc, char** argv) {

    crow::App<CORS> app;

    std::cout << "Starting numerical_backend..." << std::endl;

    // =========================
    // POST /api/solve
    // =========================
    CROW_ROUTE(app, "/api/solve")
    .methods(crow::HTTPMethod::Post)
    ([](const crow::request& req) {

        try {

            json j = json::parse(req.body);

            if (
                !j.contains("equation") ||
                !j.contains("method")
            ) {

                return crow::response(
                    400,
                    "Missing equation or method"
                );
            }

            std::string equation =
                j["equation"];

            std::string method =
                j["method"];

            double xl =
                j.value("xl", 0.0);

            double xu =
                j.value("xu", 0.0);

            double tol =
                j.value("tol", 1e-6);

            int max_iter =
                j.value("max_iter", 100);

            json output;

            // =========================
            // Bisection
            // =========================
            if (method == "bisection") {

                BisectionResult result =
                    bisection_method_expr(
                        equation,
                        xl,
                        xu,
                        tol,
                        max_iter,
                        false
                    );

                output["rows"] =
                    convert_rows(result);

                output["converged"] =
                    result.converged;

                output["message"] =
                    result.message;
            }

            // =========================
            // False Position
            // =========================
            else if (
                method == "false-position" ||
                method == "false_position" ||
                method == "falseposition"
            ) {

                BisectionResult result =
                    bisection_method_expr(
                        equation,
                        xl,
                        xu,
                        tol,
                        max_iter,
                        true
                    );

                output["rows"] =
                    convert_rows(result);

                output["converged"] =
                    result.converged;

                output["message"] =
                    result.message;
            }

            // =========================
            // Newton Method
            // =========================
            else if (method == "newton") {

                double x0 =
                    j.value(
                        "x0",
                        (xl + xu) / 2.0
                    );

                BisectionResult result =
                    newton_method_expr(
                        equation,
                        x0,
                        tol,
                        max_iter
                    );

                output["rows"] =
                    convert_rows(result);

                output["converged"] =
                    result.converged;

                output["message"] =
                    result.message;
            }

            
            // Secant Method
            // =========================
            else if (method == "secant") {
                double x0 = j.value("x0", xl);
                double x1 = j.value("x1", xu);

                BisectionResult result =
                    secant_method_expr(
                        equation,
                        x0,
                        x1,
                        tol,
                        max_iter
                    );

                output["rows"] = convert_rows(result);
                output["converged"] = result.converged;
                output["message"] = result.message;
            }

            // =========================
            // Fixed Point Method
            // =========================
            else if (method == "fixed_point" || method == "fixed-point") {
                // For fixed point, the client sends g(x) as the equation string
                double x0 = j.value("x0", (xl + xu) / 2.0);

                BisectionResult result =
                    fixed_point_method_expr(
                        equation,
                        x0,
                        tol,
                        max_iter
                    );

                output["rows"] = convert_rows(result);
                output["converged"] = result.converged;
                output["message"] = result.message;
            }

            // =========================
            // Unknown Method
            // =========================
            else {

                return crow::response(
                    400,
                    "Unknown method"
                );
            }

            crow::response resp(200);

            resp.set_header(
                "Content-Type",
                "application/json"
            );

            resp.body = output.dump();

            return resp;
        }

        catch (const std::exception& ex) {

            return crow::response(
                500,
                std::string("Server Error: ")
                + ex.what()
            );
        }
    });

    // =========================
    // POST /api/bisection
    // =========================
    CROW_ROUTE(app, "/api/bisection")
    .methods(crow::HTTPMethod::Post)
    ([](const crow::request& req) {

        try {

            json j = json::parse(req.body);

            std::string equation =
                j.value("equation", "");

            double xl =
                j.value(
                    "a",
                    j.value("xl", 0.0)
                );

            double xu =
                j.value(
                    "b",
                    j.value("xu", 0.0)
                );

            double tol =
                j.value(
                    "tol",
                    j.value("eps", 1e-6)
                );

            int max_iter =
                j.value("max_iter", 100);

            BisectionResult result =
                bisection_method_expr(
                    equation,
                    xl,
                    xu,
                    tol,
                    max_iter,
                    false
                );

            json output;

            output["rows"] =
                convert_rows(result);

            output["converged"] =
                result.converged;

            output["message"] =
                result.message;

            crow::response resp(200);

            resp.set_header(
                "Content-Type",
                "application/json"
            );

            resp.body = output.dump();

            return resp;
        }

        catch (const std::exception& ex) {

            return crow::response(
                500,
                std::string("Server Error: ")
                + ex.what()
            );
        }
    });

    // =========================
    // GET /health
    // =========================
    CROW_ROUTE(app, "/health")
    .methods(crow::HTTPMethod::Get)
    ([]() {

        json j;

        j["status"] = "running";

        crow::response r(200);

        r.set_header(
            "Content-Type",
            "application/json"
        );

        r.body = j.dump();

        return r;
    });

    // =========================
    // Run Server
    // =========================
    app.port(18080)
       .multithreaded()
       .run();

    return 0;
}