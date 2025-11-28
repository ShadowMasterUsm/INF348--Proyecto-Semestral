#!/usr/bin/env sh

# Espera hasta que el puerto esté disponible

set -e

host="$1"
shift
cmd="$@"

until nc -z "$host" 3306; do
  echo "Esperando a que MySQL ($host:3306) esté listo..."
  sleep 2
done

echo "MySQL está listo! Ejecutando comando..."
exec $cmd