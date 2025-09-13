#!/bin/bash

set -euo pipefail

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

check_response_time() {
    local url="$1"
    local max_time="$2"
    local name="$3"

    log "Checking response time for $name..."

    local response_time
    response_time=$(curl -o /dev/null -s -w '%{time_total}' "$url" || echo "999")

    local response_ms
    response_ms=$(echo "$response_time * 1000" | bc)

    if (( $(echo "$response_time > $max_time" | bc -l) )); then
        log "FAIL: $name response time ${response_ms}ms > ${max_time}000ms"
        return 1
    else
        log "PASS: $name response time ${response_ms}ms"
        return 0
    fi
}

check_service_health() {
    local service="$1"
    local url="$2"

    log "Checking health of $service..."

    if curl -f -s "$url" >/dev/null; then
        log "PASS: $service is healthy"
        return 0
    else
        log "FAIL: $service health check failed"
        return 1
    fi
}

check_docker_services() {
    log "Checking Docker services status..."

    local failed_services=0

    while IFS= read -r line; do
        local service_name=$(echo "$line" | awk '{print $2}')
        local replicas=$(echo "$line" | awk '{print $4}')

        if [[ "$replicas" == *"0/"* ]]; then
            log "FAIL: Service $service_name has 0 running replicas"
            ((failed_services++))
        else
            log "PASS: Service $service_name is running ($replicas)"
        fi
    done < <(docker service ls --filter name="zephyrfs_" --format "table {{.ID}}\t{{.Name}}\t{{.Mode}}\t{{.Replicas}}")

    return $failed_services
}

run_performance_test() {
    log "Running performance test..."

    local url="http://localhost/api/health"
    local concurrent_requests=10
    local total_requests=100

    log "Testing with $concurrent_requests concurrent requests ($total_requests total)..."

    local output
    output=$(ab -n $total_requests -c $concurrent_requests -q "$url" 2>/dev/null || echo "Test failed")

    if [[ "$output" == "Test failed" ]]; then
        log "FAIL: Performance test failed"
        return 1
    fi

    local mean_time
    mean_time=$(echo "$output" | grep "Time per request:" | head -1 | awk '{print $4}')

    if [[ -n "$mean_time" ]]; then
        log "Mean response time: ${mean_time}ms"

        if (( $(echo "$mean_time > 500" | bc -l) )); then
            log "FAIL: Mean response time exceeds 500ms"
            return 1
        else
            log "PASS: Mean response time is acceptable"
            return 0
        fi
    else
        log "FAIL: Could not parse performance test results"
        return 1
    fi
}

main() {
    local failed_tests=0

    log "Starting comprehensive health check..."

    # Check Docker services
    if ! check_docker_services; then
        ((failed_tests++))
    fi

    # Health checks
    check_service_health "Web Frontend" "http://localhost/health" || ((failed_tests++))
    check_service_health "API Server" "http://localhost/api/health" || ((failed_tests++))
    check_service_health "Prometheus" "http://localhost:9090/-/healthy" || ((failed_tests++))
    check_service_health "Grafana" "http://localhost:3001/api/health" || ((failed_tests++))

    # Response time checks (sub-500ms requirement)
    check_response_time "http://localhost/" 0.5 "Frontend" || ((failed_tests++))
    check_response_time "http://localhost/api/health" 0.5 "API Health" || ((failed_tests++))
    check_response_time "http://localhost/api/files" 0.5 "File Listing" || ((failed_tests++))

    # Performance test
    if command -v ab >/dev/null 2>&1; then
        run_performance_test || ((failed_tests++))
    else
        log "WARNING: Apache Bench (ab) not available, skipping performance test"
    fi

    log "Health check completed"

    if [[ $failed_tests -eq 0 ]]; then
        log "SUCCESS: All tests passed"
        exit 0
    else
        log "FAILURE: $failed_tests test(s) failed"
        exit 1
    fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi