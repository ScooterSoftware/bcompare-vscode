import tseslint from 'typescript-eslint';

export default [
	{
		ignores: ['out/**', 'dist/**', '**/*.d.ts']
	},
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tseslint.parser,
			ecmaVersion: 6,
			sourceType: 'module'
		},
		plugins: {
			'@typescript-eslint': tseslint.plugin
		},
		rules: {
			'@typescript-eslint/naming-convention': ['warn', {
				'selector': 'import',
				'format': ['camelCase', 'PascalCase']
			}],
			'semi': 'warn',
			'curly': 'warn',
			'eqeqeq': 'warn',
			'no-throw-literal': 'warn'
		}
	}
];
