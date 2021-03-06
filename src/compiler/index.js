import Watcher from '../watcher';
import { expToFunc } from 'util';


function walkChildren (el, scope) {
    [].slice.call(el.childNodes).forEach(node => {
        if (node.nodeType === 3) {
            compileText(node, scope);
        } else if (node.nodeType === 1) {
            walkAttributes(node, scope);
            walkChildren(node, scope);
        }
    });
}

function walkAttributes (node, scope) {
    [].slice.call(node.attributes).forEach(attrNode => {
        let attr = getAttrInfo(attrNode);
        if (attr.type !== 'raw') {
            compileAttribute(attr.type, {
                scope,
                name: attr.name,
                exp: attr.value,
                node
            });
            node.removeAttribute(attrNode.name);
        }
    });
}

function compileText (node, scope) {
    let exp = textToExp(node.textContent);
    new Watcher(exp, scope, newVal => {
        node.textContent = newVal
    });
}

function compileAttribute (type, params) {
    let { exp, name, node, scope } = params;
    switch (type) {
        case 'on':
        {
            let callback = null;
            if (typeof scope[exp] === 'function') {
                callback = scope[exp].bind(scope);
            } else {
                callback = expToFunc(exp, scope);
            }
            node.addEventListener(name, callback);
            break;
        }
        case 'bind':
        {
            new Watcher(exp, scope, newVal => {
                node.setAttribute(name, newVal);
            });
            break;
        }
        case 'show':
        {
            new Watcher(exp, scope, newVal => {
                node.style.display = newVal ? 'block' : 'none';
            });
            break;
        }
        case 'if':
        {
            let placeholder = document.createTextNode('');
            node.parentNode.insertBefore(placeholder, node);
            node.parentNode.removeChild(node);
            new Watcher(exp, scope, newVal => {
                if (newVal && !node.parentNode) {
                    placeholder.parentNode.insertBefore(node, placeholder);
                } else if (!newVal && node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            });
            break;
        }
    }
}

function getAttrInfo (attrNode) {
    let [name, value, type] = [attrNode.name, attrNode.value];

    if (name.match(/^v-/)) {
        [type, name] = name.slice(2).split(':');
    } else if (name.match(/^:/)) {
        type = 'bind';
        name = name.slice(1);
    } else if (name.match(/^@/)) {
        type = 'on';
        name = name.slice(1);
    } else {
        type = 'raw';
    }
    return { name, value, type };
}

function textToExp (text) {
    let pieces = text.split(/({{.+?}})/g);
    pieces = pieces.map(piece => {
        if (piece.match(/{{.+?}}/g)) { // {{}}内的代码，以js表达式输出
            piece = '(' + piece.replace(/^{{|}}$/g, '') + ')';
        } else { // {{}}外的代码，以字符串输出
            piece = '`' + piece.replace(/`/g, '\\`') + '`'; // 需要对字符串中的`转义
        }
        return piece;
    });
    return pieces.join('+');
}

// 编译dom，将dom中的表达式片段用watcher绑定
class Compiler {
    constructor (el, scope) {
        walkChildren(el, scope);
    }
}

export default Compiler;