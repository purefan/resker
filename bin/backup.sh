#!/bin/bash

# Backup script for MongoDB.
# Generates full collection backups compatible with
# mongorestore
# Best used in a cron job with logrotate
# In debian based systems you can install mongo tools with
# apt-get install mongodb-org-tools

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
FILE_NAME=$(date '+%Y-%m-%d-%H:%M:%S')
TARGET_DIR="${DIR}/../resker-backup"
TARGET_FILE="${TARGET_DIR}/${FILE_NAME}.gz"
mkdir -p "${TARGET_DIR}"
echo "- Starting MongoDB backup -"
echo "Will store this backup at: ${TARGET_FILE}"
mongodump --verbose --archive="${TARGET_FILE}" --gzip --db=resker