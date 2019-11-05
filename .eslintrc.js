module.exports = {
    env: {
        es6: true,
        node: true,
        mocha: true
    },
    extends: 'eslint:recommended',
    parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2018
    },
    rules: {
        indent: [ 'error', 4 ],
        'linebreak-style': [ 'error', 'unix' ],
        quotes: [ 'error', 'single' ],
        semi: [ 'error', 'never' ],
        'object-curly-spacing': 0,
        'eol-last': 0,
        'require-atomic-updates': 'off',
        'require-jsdoc': [ 'error', {
            'require': {
                'FunctionDeclaration': true,
                'MethodDefinition': false,
                'ClassDeclaration': false,
                'ArrowFunctionExpression': false,
                'FunctionExpression': false
            }
        } ]
    }
}
