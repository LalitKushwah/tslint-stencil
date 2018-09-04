import * as ts from "typescript";
import * as Lint from "tslint";
import { isComponentClass } from './shared/utils';
import { codeExamples } from './code-examples/decoratedMemberStyle.examples'

interface Options {
    properties: "singleline" | "multiline" | "ignore";
    methods: "singleline" | "multiline" | "ignore";
}

export class Rule extends Lint.Rules.AbstractRule {
    public static metadata: Lint.IRuleMetadata = {
        ruleName: 'decorated-member-style',
        description: `Requires decorated class members to follow a consistent style (singleline or multiline)`,
        optionsDescription: Lint.Utils.dedent`
            One argument which is an object with the keys \`"properties"\` and \`"methods"\`. Both can be set to a string, which must be one of the following values:
            - \`"singleline"\`
            - \`"multiline"\`
            - \`"ignore"\`

            If either key is excluded, the default behavior (\`"ignore"\`) will be applied.

            A member is considered “multiline” if its declaration is on a line after the last decorator. If decorators are composed (multiple decorators for a single declaration), "multiline" requires each decorator to be on its own line.
        `,
        options: {
            "type": "object",
            "properties": {
                "properties": {
                    "type": "string",
                    "enum": [
                        "singleline",
                        "multiline",
                        "ignore"
                    ]
                },
                "methods": {
                    "type": "string",
                    "enum": [
                        "singleline",
                        "multiline",
                        "ignore"
                    ]
                }
            }
        },
        optionExamples: [
            Lint.Utils.dedent`
                {
                    "decorated-member-style": [
                        true, 
                        {
                            "methods": "multiline"
                        }
                    ]
                }
            `,
            Lint.Utils.dedent`
                { 
                    "decorated-member-style": [
                        true, 
                        {
                            "properties": "singleline",
                            "methods": "multiline"
                        }
                    ]
                }
            `
        ],
        type: 'style',
        typescriptOnly: true,
        codeExamples
    }

    public static FAILURE_STRING_SINGLE = "Component %s decorators should be inlined";
    public static FAILURE_STRING_MULTI = "Component %s decorators should be multiline";
    public static FAILURE_STRING_MULTI_COMPOSITION = "Component %s decorators should each be on their own lines";

    public static DEFAULT_ARGUMENTS = {
        properties: 'ignore',
        methods: 'ignore'
    }

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        let args = this.getOptions().ruleArguments;
        if (args) args = args[0];
        const options: Options = Object.assign({}, Rule.DEFAULT_ARGUMENTS, args) as Options;

        return this.applyWithWalker(new MethodDecoratorWalker(sourceFile, this.getOptions(), options));
    }
}

// The walker takes care of all the work.
class MethodDecoratorWalker extends Lint.RuleWalker {

    constructor(sourceFile: ts.SourceFile, options: Lint.IOptions, private _options: Options) {
        super(sourceFile, options);
    }

    getOptions(): Options {
        return this._options;
    }

    public visitMethodDeclaration(node: ts.MethodDeclaration) {
        const { methods: style } = this.getOptions();

        if (style === 'ignore') return;

        if (style && isComponentClass(node.parent) && node.decorators && Array.isArray(node.decorators)) {

            if (style === 'multiline' && node.decorators.length > 1) {
                const decoratorLines = node.decorators.map((dec) => this.getLineAndCharacterOfPosition(dec.getEnd()).line);
                const { line: propertyLine } = this.getLineAndCharacterOfPosition(node.name.getEnd());
                const allMultiline = decoratorLines.every((line, i) => {
                    if (decoratorLines[i - 1] === undefined) return true;
                    return line > decoratorLines[i - 1];
                })

                if (!allMultiline) return this.addFailureAtNode(node, Rule.FAILURE_STRING_MULTI_COMPOSITION.replace('%s', 'method'));
                if (decoratorLines[decoratorLines.length - 1] === propertyLine) return this.addFailureAtNode(node, Rule.FAILURE_STRING_MULTI.replace('%s', 'method'));
            } else {
                const dec: ts.Decorator = node.decorators[node.decorators.length - 1];
                
                const { line: decoratorLine } = this.getLineAndCharacterOfPosition(dec.getEnd());
                const { line: propertyLine } = this.getLineAndCharacterOfPosition(node.name.getEnd());
                
                if (style === 'singleline') {
                    if (decoratorLine !== propertyLine) {
                        // node.getText(this.getSourceFile()).indexOf('\n')
                        // const fix = this.deleteText();
                        return this.addFailureAtNode(node, Rule.FAILURE_STRING_SINGLE.replace('%s', 'method'));
                    }
                } else if (style === 'multiline') {
                    if (decoratorLine === propertyLine) return this.addFailureAtNode(node, Rule.FAILURE_STRING_MULTI.replace('%s', 'method'));
                }
            }
        };

        super.visitMethodDeclaration(node);
    }

    public visitPropertyDeclaration(node: ts.PropertyDeclaration) {
        const { properties: style } = this.getOptions();

        if (style === 'ignore') return;

        if (style && isComponentClass(node.parent) && node.decorators && Array.isArray(node.decorators)) {
            const dec: ts.Decorator = node.decorators[node.decorators.length - 1];

            const { line: decoratorLine } = this.getLineAndCharacterOfPosition(dec.getEnd());
            const { line: propertyLine } = this.getLineAndCharacterOfPosition(node.name.getEnd());

            if (style === 'singleline') {
                if (decoratorLine !== propertyLine) return this.addFailureAtNode(node, Rule.FAILURE_STRING_SINGLE.replace('%s', 'property'));
            } else if (style === 'multiline') {
                if (decoratorLine === propertyLine) return this.addFailureAtNode(node, Rule.FAILURE_STRING_MULTI.replace('%s', 'property'));
            }

        };

        super.visitPropertyDeclaration(node);
    }
}