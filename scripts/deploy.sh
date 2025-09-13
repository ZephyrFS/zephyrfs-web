#!/bin/bash

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_NAME="zephyrfs"
COMPOSE_FILE="$DEPLOY_DIR/deploy/production.yml"
ENV_FILE="$DEPLOY_DIR/.env.production"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    log "ERROR: $*" >&2
    exit 1
}

check_prerequisites() {
    log "Checking prerequisites..."

    command -v docker >/dev/null 2>&1 || error "Docker is not installed"
    command -v docker-compose >/dev/null 2>&1 || error "Docker Compose is not installed"

    if ! docker info >/dev/null 2>&1; then
        error "Docker daemon is not running"
    fi

    if ! docker swarm ca >/dev/null 2>&1; then
        log "Initializing Docker Swarm..."
        docker swarm init
    fi

    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file not found: $ENV_FILE"
    fi

    log "Prerequisites check passed"
}

build_images() {
    log "Building Docker images..."

    # Build client image
    docker build -t zephyrfs/web-client:latest \
        -f "$DEPLOY_DIR/client/Dockerfile" \
        "$DEPLOY_DIR/client"

    # Build server image
    docker build -t zephyrfs/web-server:latest \
        -f "$DEPLOY_DIR/server/Dockerfile" \
        "$DEPLOY_DIR/server"

    log "Images built successfully"
}

setup_secrets() {
    log "Setting up Docker secrets..."

    if ! docker secret inspect jwt_secret >/dev/null 2>&1; then
        if [[ -n "${JWT_SECRET:-}" ]]; then
            echo "$JWT_SECRET" | docker secret create jwt_secret -
        else
            openssl rand -base64 32 | docker secret create jwt_secret -
        fi
        log "JWT secret created"
    fi
}

setup_volumes() {
    log "Setting up volumes and directories..."

    local data_path="${DATA_PATH:-/opt/zephyrfs/data}"
    local ssl_path="${SSL_CERTS_PATH:-/opt/zephyrfs/ssl}"

    sudo mkdir -p "$data_path" "$ssl_path"
    sudo chown -R 1000:1000 "$data_path"

    log "Volumes configured"
}

deploy_stack() {
    log "Deploying Docker stack..."

    docker stack deploy \
        --compose-file "$COMPOSE_FILE" \
        --with-registry-auth \
        "$STACK_NAME"

    log "Stack deployment initiated"
}

wait_for_services() {
    log "Waiting for services to be ready..."

    local max_wait=300
    local wait_time=0

    while [[ $wait_time -lt $max_wait ]]; do
        if docker service ls --filter name="${STACK_NAME}_" --format "{{.Replicas}}" | grep -q "0/"; then
            log "Services still starting... (${wait_time}s)"
            sleep 10
            wait_time=$((wait_time + 10))
        else
            log "All services are running"
            return 0
        fi
    done

    error "Services failed to start within ${max_wait} seconds"
}

health_check() {
    log "Performing health checks..."

    local endpoints=(
        "http://localhost/api/health"
        "http://localhost:9090/-/healthy"
        "http://localhost:3001/api/health"
    )

    for endpoint in "${endpoints[@]}"; do
        if curl -f -s "$endpoint" >/dev/null; then
            log "Health check passed: $endpoint"
        else
            log "WARNING: Health check failed: $endpoint"
        fi
    done
}

update_stack() {
    log "Performing rolling update..."

    # Update images
    build_images

    # Deploy with updated images
    deploy_stack

    # Wait for rolling update to complete
    wait_for_services

    log "Rolling update completed"
}

rollback_stack() {
    log "Rolling back to previous version..."

    docker service rollback "${STACK_NAME}_web-client"
    docker service rollback "${STACK_NAME}_web-server"

    wait_for_services

    log "Rollback completed"
}

cleanup() {
    log "Cleaning up unused resources..."

    docker system prune -f
    docker volume prune -f

    log "Cleanup completed"
}

main() {
    local action="${1:-deploy}"

    case "$action" in
        deploy)
            check_prerequisites
            build_images
            setup_secrets
            setup_volumes
            deploy_stack
            wait_for_services
            health_check
            ;;
        update)
            check_prerequisites
            update_stack
            health_check
            ;;
        rollback)
            check_prerequisites
            rollback_stack
            health_check
            ;;
        cleanup)
            cleanup
            ;;
        *)
            echo "Usage: $0 {deploy|update|rollback|cleanup}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Initial deployment or full redeploy"
            echo "  update   - Rolling update with zero downtime"
            echo "  rollback - Rollback to previous version"
            echo "  cleanup  - Clean up unused Docker resources"
            exit 1
            ;;
    esac

    log "Operation '$action' completed successfully"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi