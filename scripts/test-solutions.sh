#!/usr/bin/env bash
# Compile and run the reference solutions for problems 106-128 against known answers,
# under ASan + UBSan. Any change to scripts/gap_problems_2.mjs must keep this green.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
node -e "
Promise.all([import('$here/gap_problems_2.mjs'), import('$here/gap_problems_3.mjs'), import('$here/gap_problems_4.mjs')]).then(([a, b, c]) => {
  const fs = require('fs');
  for (const p of [...a.GAP_PROBLEMS_2, ...b.GAP_PROBLEMS_3, ...c.GAP_PROBLEMS_4]) fs.writeFileSync('$out/p' + p.id + '.inc', p.tabCode + '\n');
});"
CXX=${CXX:-clang++}
for suite in gap_solutions_test gap3_solutions_test gap4_solutions_test; do
  cp "$here/cpp/$suite.cpp" "$out/$suite.cpp"
  "$CXX" -std=c++20 -O1 -Wall -Wextra -Werror -fsanitize=address,undefined -fno-sanitize-recover=undefined \
    -I"$out" -o "$out/$suite" "$out/$suite.cpp"
  "$out/$suite"
done
