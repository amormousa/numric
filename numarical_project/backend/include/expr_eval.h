// Lightweight expression evaluator (single-header)
// Supports: + - * / ^, parentheses, functions: sin, cos, tan, asin, acos, atan,
// sqrt, abs, ln/log/log10, exp, floor, ceil, round, constants pi/e, variable x
// Implements shunting-yard to RPN and RPN evaluation.
#pragma once

#include <string>
#include <vector>
#include <stack>
#include <unordered_map>
#include <cmath>
#include <stdexcept>
#include <cctype>
#include <sstream>

namespace expr {

struct Token {
    enum Type {Number, Variable, Op, Func, LeftParen, RightParen} type;
    double value = 0.0; // for Number
    std::string text;   // for Func or Op
};

inline bool isAlpha(char c) { return std::isalpha((unsigned char)c) || c=='_'; }
inline bool isNumChar(char c) { return std::isdigit((unsigned char)c) || c=='.'; }

class Expression {
    std::vector<Token> rpn;

    static int precedence(const std::string &op) {
        if (op == "+" || op == "-") return 1;
        if (op == "*" || op == "/") return 2;
        if (op == "^") return 3;
        return 0;
    }

    static bool isRightAssociative(const std::string &op) {
        return op == "^";
    }

    static double callFunc(const std::string &name, double v) {
        if (name == "sin") return std::sin(v);
        if (name == "cos") return std::cos(v);
        if (name == "tan") return std::tan(v);
        if (name == "asin") return std::asin(v);
        if (name == "acos") return std::acos(v);
        if (name == "atan") return std::atan(v);
        if (name == "sqrt") return std::sqrt(v);
        if (name == "abs") return std::fabs(v);
        if (name == "ln" || name == "log") return std::log(v);
        if (name == "log10") return std::log10(v);
        if (name == "exp") return std::exp(v);
        if (name == "floor") return std::floor(v);
        if (name == "ceil") return std::ceil(v);
        if (name == "round") return std::round(v);
        throw std::runtime_error(std::string("Unknown function: ") + name);
    }

    static std::vector<Token> tokenize(const std::string &expr) {
        std::vector<Token> out;
        size_t i = 0;
        while (i < expr.size()) {
            char c = expr[i];
            if (std::isspace((unsigned char)c)) { i++; continue; }
            if (isNumChar(c)) {
                size_t j = i;
                while (j < expr.size() && (isNumChar(expr[j]) || (expr[j]=='e' || expr[j]=='E') )) {
                    if ((expr[j]=='e' || expr[j]=='E') && j+1 < expr.size() && (expr[j+1]=='+'||expr[j+1]=='-'||std::isdigit((unsigned char)expr[j+1]))) {
                        j+=2; // skip e and sign/digit - simple support
                        while (j < expr.size() && std::isdigit((unsigned char)expr[j])) j++;
                        break;
                    }
                    j++;
                }
                double v = std::stod(expr.substr(i, j - i));
                Token t; t.type = Token::Number; t.value = v; out.push_back(t);
                i = j; continue;
            }
            if (isAlpha(c)) {
                size_t j = i;
                while (j < expr.size() && (isAlpha(expr[j]) || std::isdigit((unsigned char)expr[j]))) j++;
                std::string name = expr.substr(i, j - i);
                // lower-case
                for (auto &ch : name) ch = (char)std::tolower((unsigned char)ch);
                if (name == "x") { Token t; t.type = Token::Variable; out.push_back(t); }
                else if (name == "pi" || name == "e") { Token t; t.type = Token::Number; t.value = (name=="pi"? M_PI: M_E); out.push_back(t); }
                else { Token t; t.type = Token::Func; t.text = name; out.push_back(t); }
                i = j; continue;
            }
            if (c == '(') { Token t; t.type = Token::LeftParen; out.push_back(t); i++; continue; }
            if (c == ')') { Token t; t.type = Token::RightParen; out.push_back(t); i++; continue; }
            // operators
            if (std::string("+-*/^").find(c) != std::string::npos) {
                Token t; t.type = Token::Op; t.text = std::string(1, c); out.push_back(t); i++; continue;
            }
            throw std::runtime_error(std::string("Invalid character in expression: ") + c);
        }
        return out;
    }

    static std::vector<Token> toRPN(const std::vector<Token>& tokens) {
        std::vector<Token> output;
        std::stack<Token> ops;

        for (size_t i = 0; i < tokens.size(); ++i) {
            const Token &t = tokens[i];
            if (t.type == Token::Number || t.type == Token::Variable) {
                output.push_back(t);
            } else if (t.type == Token::Func) {
                ops.push(t);
            } else if (t.type == Token::Op) {
                std::string o1 = t.text;
                while (!ops.empty() && (ops.top().type == Token::Op || ops.top().type == Token::Func)) {
                    if (ops.top().type == Token::Func) {
                        output.push_back(ops.top()); ops.pop();
                    } else {
                        std::string o2 = ops.top().text;
                        int p1 = precedence(o1);
                        int p2 = precedence(o2);
                        if ((isRightAssociative(o1) && p1 < p2) || (!isRightAssociative(o1) && p1 <= p2)) {
                            output.push_back(ops.top()); ops.pop();
                            continue;
                        }
                        break;
                    }
                }
                ops.push(t);
            } else if (t.type == Token::LeftParen) {
                ops.push(t);
            } else if (t.type == Token::RightParen) {
                bool foundLeft = false;
                while (!ops.empty()) {
                    if (ops.top().type == Token::LeftParen) { ops.pop(); foundLeft = true; break; }
                    output.push_back(ops.top()); ops.pop();
                }
                if (!foundLeft) throw std::runtime_error("Mismatched parentheses");
                if (!ops.empty() && ops.top().type == Token::Func) { output.push_back(ops.top()); ops.pop(); }
            }
        }

        while (!ops.empty()) {
            if (ops.top().type == Token::LeftParen || ops.top().type == Token::RightParen) throw std::runtime_error("Mismatched parentheses");
            output.push_back(ops.top()); ops.pop();
        }

        return output;
    }

public:
    Expression(const std::string &expr) {
        auto toks = tokenize(expr);
        // handle unary minus: convert leading -number or (-...) or operator followed by - to 0 - x
        // we'll do a simple pass to inject 0 before unary - when appropriate
        std::vector<Token> fixed;
        for (size_t i = 0; i < toks.size(); ++i) {
            const Token &t = toks[i];
            if (t.type == Token::Op && t.text == "-") {
                bool unary = false;
                if (i==0) unary = true;
                else {
                    const Token &prev = toks[i-1];
                    if (prev.type == Token::Op || prev.type == Token::LeftParen || prev.type == Token::Func) unary = true;
                }
                if (unary) {
                    Token zero; zero.type = Token::Number; zero.value = 0.0; fixed.push_back(zero);
                }
            }
            fixed.push_back(t);
        }

        rpn = toRPN(fixed);
    }

    double eval(double x) const {
        std::stack<double> st;
        for (const auto &t : rpn) {
            if (t.type == Token::Number) st.push(t.value);
            else if (t.type == Token::Variable) st.push(x);
            else if (t.type == Token::Op) {
                if (st.size() < 2) throw std::runtime_error("Invalid expression evaluation");
                double b = st.top(); st.pop();
                double a = st.top(); st.pop();
                double r = 0;
                if (t.text == "+") r = a + b;
                else if (t.text == "-") r = a - b;
                else if (t.text == "*") r = a * b;
                else if (t.text == "/") r = a / b;
                else if (t.text == "^") r = std::pow(a, b);
                else throw std::runtime_error(std::string("Unknown operator: ") + t.text);
                st.push(r);
            } else if (t.type == Token::Func) {
                if (st.empty()) throw std::runtime_error("Invalid function application");
                double v = st.top(); st.pop();
                double r = callFunc(t.text, v);
                st.push(r);
            } else {
                throw std::runtime_error("Unexpected token during evaluation");
            }
        }
        if (st.size() != 1) throw std::runtime_error("Invalid expression evaluation final stack");
        return st.top();
    }
};

} // namespace expr
