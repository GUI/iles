import type { MDXJsxFlowElement, MDXJsxTextElement } from 'mdast-util-mdx-jsx'
import type { MDXJSEsm } from 'mdast-util-mdxjs-esm'
import type { Image } from 'mdast'
import type { Plugin } from 'unified'
import type { Parent, Node } from 'unist'

import { visit, SKIP } from 'unist-util-visit'

// eslint-disable-next-line unicorn/no-unsafe-regex
const urlPattern = /^(https?:)?\//
const relativePathPattern = /\.\.?\//

/**
 * A Remark plugin for converting Markdown images to MDX images using imports for the image source.
 */
export const remarkPlugin = () => (ast: Parent) => {
  const imports: Omit<MDXJSEsm, 'value'>[] = []
  const imported = new Map<string, string>()

  visit(ast, (node, index, parent) => {
    let replaceWith

    if (isJsxElement(node)) {
      if (node.name === 'source') replaceSrcsetAttribute(node, 'srcset')
      else if (node.name === 'img') replaceSrcAttribute(node)
    }
    else if (node.type === 'image') {
      return replaceImageTag(node, index, parent)
      // parent!.children.splice(index!, 1, replaceWith)
      // return SKIP
    }
  })

  // visit(ast, 'image', (node, index, parent) => {
  //   console.log(node)
    // let { alt = null, title, url } = node
    // if (urlPattern.test(url))
    //   return

    // if (!relativePathPattern.test(url) && resolve)
    //   url = `./${url}`

    // let name = imported.get(url)
    // if (!name) {
    //   name = `__${imported.size}_${url.replace(/\W/g, '_')}__`

    //   imports.push({
    //     type: 'mdxjsEsm',
    //     data: {
    //       estree: {
    //         type: 'Program',
    //         sourceType: 'module',
    //         body: [
    //           {
    //             type: 'ImportDeclaration',
    //             source: { type: 'Literal', value: url, raw: JSON.stringify(url) },
    //             specifiers: [
    //               {
    //                 type: 'ImportDefaultSpecifier',
    //                 local: { type: 'Identifier', name },
    //               },
    //             ],
    //           },
    //         ],
    //       },
    //     },
    //   })
    //   imported.set(url, name)
    // }

    // const textElement: MDXJsxTextElement = {
    //   type: 'mdxJsxTextElement',
    //   name: 'img',
    //   children: [],
    //   attributes: [
    //     { type: 'mdxJsxAttribute', name: 'alt', value: alt },
    //     {
    //       type: 'mdxJsxAttribute',
    //       name: 'src',
    //       value: {
    //         type: 'mdxJsxAttributeValueExpression',
    //         value: name,
    //         data: {
    //           estree: {
    //             type: 'Program',
    //             sourceType: 'module',
    //             comments: [],
    //             body: [{ type: 'ExpressionStatement', expression: { type: 'Identifier', name } }],
    //           },
    //         },
    //       },
    //     },
    //   ],
    // }
    // if (title)
    //   textElement.attributes.push({ type: 'mdxJsxAttribute', name: 'title', value: title });

    // (parent as Parent).children.splice(index, 1, textElement)
  // })

  ast.children.unshift(...imports)
}

function isJsxElement (node: Node): node is MDXJsxFlowElement {
  return node.type === 'mdxJsxFlowElement'
}
