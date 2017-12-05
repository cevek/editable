import * as React from 'react';
import { htmlAttrsToJsxAttrsMap } from './Attrs';

// console.log(converter.convert('<div class="yep" data-flow for="213">Hello world!</div>'));

function isReactElement(value: any): value is React.ReactElement<{}> {
    return typeof value === 'object' && value !== null && typeof value.type === 'string';
}

const DataText = 'data-text';
const DataAction = 'data-action';
const originalCreateElement = React.createElement;
(React as any).createElement = function (tag: string | typeof React.Component, props: any, ...children: any[]) {
    if (typeof tag === 'string' && props !== null && props[DataText] === 'true') {
        props[DataText] = Math.random().toString(33).substr(2, 5);
    }
    if (typeof tag === 'function' && tag.prototype !== undefined && typeof tag.prototype.render === 'function') {
        const propsParamIds: { [key: string]: string } = {};
        if (props !== null) {
            const keys = Object.keys(props);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const value = props[key];
                if (isReactElement(value) && value.props[DataText]) {
                    propsParamIds[value.props[DataText]] = key;
                }
            }
        }
        if (children.length === 1) {
            const child = children[0];
            if (isReactElement(child) && child.props[DataText]) {
                propsParamIds[child.props[DataText]] = 'children';
            }
        }
        return originalCreateElement(ComponentWrap, {
            Class: tag,
            propsParamIds,
            children: originalCreateElement(tag, props, ...children)
        });
    }
    return originalCreateElement.apply(this, arguments);
};


interface CustomNode extends Node {
    _componentClassAndProps: { props: any; Class: React.ComponentClass };
    _componentWrap: ComponentWrap;
    _original: CustomNode;
    _copy: CustomNode;
    contentEditable: string;
}

document.body.addEventListener('click', e => {
    let x = e.target as CustomNode;
    let hasEditableParent = false;
    while (x instanceof HTMLElement) {
        if (x.contentEditable === 'true') {
            hasEditableParent = true;
        }
        if (!hasEditableParent && x.hasAttribute(DataText)) {
            return beginEditable(x);
        }
        if (x.hasAttribute(DataAction)) {
            hasEditableParent = true;
        }
        x = x.parentNode as CustomNode;
    }
    if (!hasEditableParent) {
        endEditable();
    }
});


let currentEditable: CustomNode | undefined;

function beginEditable(node: CustomNode) {
    const selection = window.getSelection();
    let anchor: CustomNode | undefined;
    let offset = 0;
    if (selection.type === 'Caret') {
        anchor = selection.anchorNode as CustomNode;
        if (anchor._copy === undefined && anchor._original !== undefined) {
            anchor = anchor._original;
        }
        offset = selection.anchorOffset;
    }
    endEditable(() => {
        if (node._original) {
            node = node._original;
        }
        currentEditable = copyNode(node);
        currentEditable.contentEditable = 'true';
        node.parentNode!.replaceChild(currentEditable, node);
        if (selection.type === 'Caret' && anchor) {
            selection.removeAllRanges();
            if (document.contains(anchor._copy)) {
                const range = document.createRange();
                range.setStart(anchor._copy, offset);
                range.setEnd(anchor._copy, offset);
                selection.addRange(range);
            }
        }
    });
}

function endEditable(callback?: () => void) {
    if (currentEditable !== undefined) {
        let nodeWithWrap = currentEditable;
        let vnode;
        let componentWrap: ComponentWrap | undefined;
        while (nodeWithWrap) {
            if (nodeWithWrap._componentWrap !== undefined) {
                if (nodeWithWrap._componentWrap.props.Class.editable) {
                    componentWrap = nodeWithWrap._componentWrap;
                    vnode = createVDomFromDom(nodeWithWrap.childNodes[0] as CustomNode);
                    break;
                }
            }
            nodeWithWrap = nodeWithWrap.parentNode as CustomNode;
        }
        currentEditable.parentNode!.replaceChild(currentEditable._original, currentEditable);
        currentEditable = undefined;
        if (vnode !== undefined) {
            rebuildComponentRender(componentWrap!, vnode, callback);
            return;
        }
    }
    callback && callback();
}

function restartEditable() {
    // if (currentEditable !== undefined) {
    //     const root = findEditableRoot(currentEditable);
    //
    // }

}

function findEditableRootComponent(node: CustomNode) {
    let nodeWithWrap = node;
    while (nodeWithWrap) {
        if (nodeWithWrap._componentWrap !== undefined) {
            if (nodeWithWrap._componentWrap.props.Class.editable) {
                return nodeWithWrap._componentWrap._reactInternalFiber.child.child.stateNode;
            }
        }
        nodeWithWrap = nodeWithWrap.parentNode as CustomNode;
    }
    throw new Error('Something is wrong');
}


function insertComponentAtSelection(Class: React.ComponentClass, props: any) {
    if (currentEditable !== undefined) {
        const selection = window.getSelection();
        if (selection.anchorNode !== null) {
            const node = document.createElement('span') as Node as CustomNode;
            node._componentClassAndProps = { Class, props };
            selection.anchorNode.parentNode!.insertBefore(node, selection.anchorNode);
            const currentEditable2 = currentEditable._original;
            endEditable(() => {
                beginEditable(currentEditable2);
            });
        }
    }
}

function copyNode(node: CustomNode) {
    const copy = node.cloneNode() as CustomNode;
    copy._componentWrap = node._componentWrap;
    copy._original = node;
    node._copy = copy;
    if (node instanceof HTMLElement) {
        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i] as CustomNode;
            copy.appendChild(copyNode(child));
        }
    }
    return copy;
}

function tagPropsToVdomProps(tag: HTMLElement) {
    const props = {};
    for (let i = 0; i < tag.attributes.length; i++) {
        const attr = tag.attributes.item(i);
        const name = attr.name;
        if (name === 'contenteditable' || name === 'style') continue;
        const value = attr.value;
        /*if (name === DataText && ((tag as Node as CustomNode)._original === undefined || (tag as Node as CustomNode)._copy === undefined)) {
            continue;
        } else */
        if (name.match(/^(data|aria)-/)) {
            props[name] = value;
        } else {
            const convertedName = htmlAttrsToJsxAttrsMap[name];
            props[convertedName === undefined ? name : convertedName] = value;
        }
    }
    return props;
}

function rebuildComponentRender(componentWrap: ComponentWrap, vnode: React.ReactNode, callback?: () => void) {
    componentWrap.props.Class.prototype.render = function () {
        return vnode;
    };
    componentWrap._reactInternalFiber.child.child.stateNode.forceUpdate(callback);
}


function createVDomFromDom(dom: CustomNode): React.ReactNode {
    if (dom instanceof HTMLElement) {
        let tagName = dom.localName!;
        let tagProps = tagPropsToVdomProps(dom);
        if (dom.style.cssText === 'display: inline !important;') {
            if (dom.childNodes.length === 1) {
                return createVDomFromDom(dom.childNodes[0] as CustomNode);
            } else {
                tagName = 'span';
                tagProps = {};
            }
        }
        if (dom._componentWrap !== undefined) {
            const ChildComponentClass = dom._componentWrap.props.Class;
            const props = dom._componentWrap.props.children.props;
            const newProps = { ...props };
            findAndApplyEditableProps(dom.childNodes[0] as CustomNode, dom._componentWrap.props.propsParamIds, newProps);
            return React.createElement(ChildComponentClass, newProps);
        } else if (dom._componentClassAndProps !== undefined) {
            return React.createElement(dom._componentClassAndProps.Class, dom._componentClassAndProps.props);
        }
        const children: React.ReactNode[] = [];
        for (let i = 0; i < dom.childNodes.length; i++) {
            const child = dom.childNodes[i] as CustomNode;
            children.push(createVDomFromDom(child));
        }
        if (children.length === 0 && tagProps[DataText]) {
            children.push(' ');
        }
        return React.createElement(tagName, tagProps, ...children);
    }
    else if (dom instanceof Text) {
        return dom.nodeValue;
    } else {
        console.error('wtf', dom);
        return '';
    }
}


function findAndApplyEditableProps(dom: CustomNode, ownerPropsId: { [key: string]: string }, props: any) {
    if (dom instanceof HTMLElement) {
        const paramId = dom.getAttribute(DataText);
        const prop = ownerPropsId[paramId!];
        if (prop !== undefined) {
            props[prop] = createVDomFromDom(dom);
        } else {
            for (let i = 0; i < dom.childNodes.length; i++) {
                const child = dom.childNodes[i] as CustomNode;
                findAndApplyEditableProps(child, ownerPropsId, props);
            }
        }
    }
}

interface ComponentWrapProps {
    Class: React.ComponentClass & { editable?: boolean };
    propsParamIds: { [key: string]: string };
    children: React.ReactElement<React.Component>
}

class ComponentWrap extends React.Component<ComponentWrapProps> {
    _reactInternalFiber: {
        child: {
            child: {
                stateNode: React.Component
            }
        }
    };

    el: CustomNode;
    setRef = (el: any) => {
        if (el instanceof Node) {
            this.el = el as CustomNode;
            this.el._componentWrap = this;
        }
    };

    render() {
        const { children } = this.props;
        return (
            <span ref={this.setRef} data-wrap={this.props.Class.name} contentEditable={false}>
                {children}
            </span>
        );
    }
}

class Link extends React.Component {
    render() {
        const { children } = this.props;
        return (
            <em className="link">[{children}]</em>
        );
    }
}


export class ExampleWrap extends React.Component {
    addLink = () => {
        insertComponentAtSelection(Link, { children: <span data-text>Foo</span> });
    };

    render() {
        return (
            <div>
                <button data-action onClick={this.addLink}>Add Link</button>
                <Example/>
            </div>
        );
    }
}

export class Example extends React.Component {
    static editable = true;

    render() {
        return (
            <div className="Example">
                <div data-text>
                    Before
                    <Link>
                        <span data-text>Yeah</span>
                    </Link>
                    After
                </div>
                End
            </div>
        );
    }
}