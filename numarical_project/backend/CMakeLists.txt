cmake_minimum_required(VERSION 3.10)
project(numerical_backend)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)

add_executable(numerical_backend
    main.cpp
    methods/bisection_clean.cpp
)

target_compile_definitions(numerical_backend PRIVATE ASIO_STANDALONE)

find_package(Threads REQUIRED)
target_link_libraries(numerical_backend PRIVATE Threads::Threads)

if(WIN32)
    # Link Winsock library required by asio on Windows
    target_link_libraries(numerical_backend PRIVATE ws2_32 mswsock)
endif()
