#!/bin/bash

# For Adobe Oauth server-to-server credentials:
# Generate an Adobe ID access token from client_secret
# Note: the resulting token will be valid for 24 hours

CLIENT_ID="$1"
CLIENT_SECRET="$2"
SCOPE="$3"

# check that all args are non-empty
if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ] || [ -z "$SCOPE" ]; then
  echo "Usage: create-ims-token.sh <CLIENT_ID> <CLIENT_SECRET> <SCOPE>"
  exit 1
fi

curl -sS -X POST 'https://ims-na1.adobelogin.com/ims/token/v3' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&scope=${SCOPE}" \
  | node -e 'console.log(JSON.parse(require("fs").readFileSync(0)).access_token);'
