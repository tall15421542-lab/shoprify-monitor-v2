#!/usr/bin/env bash

set -euo pipefail

CONTAINER_NAME="shopify-mongo"
IMAGE="mongo:7"
REPL_SET="rs0"
PORT_MAPPING="27017:27017"

echo "Stopping existing container (if any)..."
docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker rm "${CONTAINER_NAME}" >/dev/null 2>&1 || true

echo "Removing existing data volumes (if any)..."
existing_volumes="$(docker inspect "${CONTAINER_NAME}" --format '{{- range .Mounts -}}{{.Name}} {{- end -}}' 2>/dev/null || true)"
if [[ -n "${existing_volumes}" ]]; then
  docker volume rm ${existing_volumes} >/dev/null 2>&1 || true
fi

echo "Starting fresh MongoDB container..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p "${PORT_MAPPING}" \
  "${IMAGE}" \
  --replSet "${REPL_SET}"

echo "Waiting for MongoDB to accept connections..."
MAX_ATTEMPTS=30
SLEEP_SECONDS=2
attempt=1
until docker exec "${CONTAINER_NAME}" mongosh --quiet --eval "db.runCommand({ ping: 1 })" >/dev/null 2>&1; do
  if (( attempt >= MAX_ATTEMPTS )); then
    echo "MongoDB did not become ready in time. Check container logs with 'docker logs ${CONTAINER_NAME}'."
    exit 1
  fi
  sleep "${SLEEP_SECONDS}"
  ((attempt++))
done

echo "Initializing replica set..."
docker exec "${CONTAINER_NAME}" mongosh --quiet --eval "rs.initiate({_id: '${REPL_SET}', members: [{ _id: 0, host: 'localhost:27017' }]})"

echo "MongoDB restart complete."

