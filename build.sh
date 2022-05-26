if [[ ! -d node_modules ]]
then
    npm i
fi

tsc --build --pretty

if [[ $? == "" ]]
then
    if [[ ! -d dist/node_modules ]]
    then
        mkdir -p dist/node_modules
        ln -s "$(realpath node_modules)" "$(realpath dist/node_modules)"
    fi
    tsc --removeComments
fi
