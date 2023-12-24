#!/bin/bash -e

major_version="${GITHUB_REF_NAME%%.*}"
git push origin :refs/tags/$major_version
git push origin :refs/tags/latest
git tag $major_version
git tag latest
git push origin --tags
