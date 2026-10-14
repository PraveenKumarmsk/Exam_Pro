#!/bin/sh
# ExamPro one-command start (Mac/Linux). Needs Node.js 22.13+
cd "$(dirname "$0")"
[ -f data/exampro.db ] || node --no-warnings server/seed.js
node --no-warnings server/index.js
