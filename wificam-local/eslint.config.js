import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ignores:['build/**','dist/**','node_modules/**']},js.configs.recommended,...ts.configs.recommended,{files:['**/*.mjs'],languageOptions:{globals:{process:'readonly',console:'readonly',URL:'readonly'}}});
