echo "Building"
tsc --build --pretty

if [[ $? == 0 ]]
then
    echo "Build success"
    if [[ ! -d dist/node_modules ]]
    then
        ln -s "$(realpath node_modules)" "$(realpath dist/)"
    fi
    tsc --removeComments
else
    echo "Build failed"
fi
