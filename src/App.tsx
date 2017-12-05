import * as React from 'react';
import './App.css';

const logo = require('./logo.svg');


let currentEditable: HTMLElement | undefined;

const origCreateElement = React.createElement;
(React as any).createElement = function (tag: any, props: any, ...children: any[]) {
    if (!props) {
        props = {};
    } else {
        // props = {...props};
    }
    if (children.length === 1) {
        children = children[0];
    }
    else if (children.length === 0) {
        children = props.children;
    }
    props.children = children;
    const current = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner.current;

    if (tag === TextView) {
        props.ref = (el: any) => {
            if (el) {
                el._owner = current ? current.stateNode : null;
                el._props = props;
                // el._tag = props;
            }
        };
    } else {
        if (typeof tag === 'function') {
            if (props) {
                const keys = Object.keys(props);
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    const value = props[key];
                    if (typeof value === 'object' && value && value.type === TextView) {
                        props.instanceId = Math.random();
                        props[key] = React.createElement(value.type, {
                            ...value.props,
                            ownerPropsId: props.instanceId,
                            ownerPropsName: key
                        });
                        // if (!props.editableProps) {
                        //     props.editableProps = [];
                        // }
                        // props.editableProps.push({ key, value });
                    }
                }
            }
        }
        // console.log(tag, props);
        const origRef = props.ref;
        props.ref = (el: any) => {
            if (el) {
                el._owner = current ? current.stateNode : null;
                el._props = props;
                // el._tag = props;
            }
            if (typeof origRef === 'function') {
                origRef(el);
            } else if (typeof origRef === 'string' && current && current.stateNode) {
                current.stateNode.refs = { ...current.stateNode.refs, [origRef]: el };
            } else if (origRef === undefined) {} else {
                console.error(el);
            }
        };
        if (typeof tag === 'function' && tag !== Wrap && tag.prototype && typeof tag.prototype.render === 'function') {
            const origRender = tag.prototype.render;
            tag.prototype.render = function () {
                return origCreateElement(Wrap, { ref: '__root', owner: this }, origRender.call(this));
            };
        }
    }
    return origCreateElement(tag, props);
};

function rebuildOwnerRender(owner: React.Component) {
    const vdom = createVDomFromDom((owner.refs.__root as any).refs.root.childNodes[0]);
    if (currentEditable) {
        const original = (currentEditable as any)._original;
        currentEditable.parentNode!.replaceChild(original, currentEditable);
        currentEditable = undefined;
    }
    owner.render = function () {
        return origCreateElement(Wrap, { ref: '__root', owner: this }, vdom);
    };
    owner.forceUpdate();
}

function createVDomFromDom(dom: Node): any {
    if (dom instanceof HTMLElement) {
        if ((dom as any)._componentWrap && (dom as any)._componentWrap.constructor == Wrap) {
            const cmp = (dom as any)._componentWrap.props.owner;
            const arr: any = [];
            findTextViewAsProps(dom, cmp.props.instanceId, arr);
            console.log(arr);
            const newProps = { ...cmp.props };
            for (let i = 0; i < arr.length; i++) {
                const item = arr[i];
                newProps[item.key] = React.createElement(TextView, {}, createVDomFromDom(item.dom.childNodes[0]));
            }
            return React.createElement(cmp.constructor, newProps);
        }
        const children: any[] = [];
        for (let i = 0; i < dom.childNodes.length; i++) {
            const child = dom.childNodes[i];
            children.push(createVDomFromDom(child));
        }
        return React.createElement(dom.tagName.toLowerCase(), (dom as any)._props, ...children);
    }
    else if (dom instanceof Text) {
        return dom.nodeValue;
    } else {
        console.log('wtf', dom);
        return '';
    }
}

function findTextViewAsProps(dom: any, ownerPropsId: number, arr: any[]) {
    if (dom instanceof HTMLElement) {
        if ((dom as any)._componentWrap.props.ownerPropsId === ownerPropsId) {
            arr.push({ key: (dom as any)._componentWrap.props.ownerPropsName, dom });
        } else {
            for (let i = 0; i < dom.childNodes.length; i++) {
                const child = dom.childNodes[i];
                findTextViewAsProps(child, ownerPropsId, arr);
            }
        }
    }
}

document.body.addEventListener('click', e => {
    let x: any = e.target;
    let hasEditableParent = false;
    while (x instanceof HTMLElement) {
        if (x.contentEditable === 'true') {
            hasEditableParent = true;
        }
        x = x.parentNode;
    }
    if (!hasEditableParent && currentEditable) {
        currentEditable.contentEditable = 'false';
        rebuildOwnerRender((currentEditable as any)._componentWrap._componentWrap);
    }
});

function copyNode(node: any) {
    const copy = node.cloneNode();
    copy._componentWrap = node._componentWrap;
    copy._props = node._props;
    if (node instanceof HTMLElement) {
        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];
            copy.appendChild(copyNode(child));
        }
    }
    return copy;
}

class TextView extends React.Component {
    onDblClick(ev: React.MouseEvent<HTMLElement>) {
        if (currentEditable) {
            currentEditable.contentEditable = 'false';
        }
        const root = this.refs.root as HTMLElement;
        currentEditable = copyNode(root);
        (currentEditable as any)._original = root;
        currentEditable!.contentEditable = 'true';
        root.parentNode!.replaceChild(currentEditable!, root);
        ev.stopPropagation();
    }

    render() {
        const { children } = this.props;
        return (
            <div ref='root' onDoubleClick={e => this.onDblClick(e)} contentEditable={false}>
                {children}
            </div>
        );
    }
}

const map = new Map<Node, React.Component>();
(window as any).map = map;

class Wrap extends React.Component<{ owner: any }> {
    render() {
        const { children } = this.props;
        return (
            <div ref='root' contentEditable={false}>
                {children}
            </div>
        );
    }

    contentProps = {};

    componentDidMount() {
        map.set(this.refs.root as any, this);
    }
}

class Bar extends React.Component {
    render() {
        const { children } = this.props;
        return (
            <div>
                <div>
                    <TextView>I'm Bar</TextView>
                    {children}
                    <TextView>Haha</TextView>
                </div>
            </div>
        );
    }
}

class Foo extends React.Component {
    render() {
        const { children } = this.props;
        return (
            <div>
                <TextView>I'm Foo, what do you think</TextView>
                <Bar>{children}</Bar>
            </div>
        );
    }
}

class Link extends React.Component {
    render() {
        const { children } = this.props;
        return (
            <em>{children}</em>
        );
    }

}

class App extends React.Component {
    render() {
        return (
            <div className="App">
                {/*<TextView>*/}
                {/*<div className="App-header">*/}
                {/*<img src={logo} className="App-logo" alt="logo"/>*/}
                {/*<h2>Welcome to React</h2>*/}
                {/*</div>*/}
                {/*<Foo>*/}
                {/*<span>What do you mean?</span>*/}
                {/*</Foo>*/}
                {/*<div>To get started, edit <code>src/App.tsx</code> and save to reload.</div>*/}
                {/*</TextView>*/}
                {/*Yeah*/}
                <TextView>
                    Before
                    <Link>
                        <TextView>Yeah</TextView>
                    </Link>
                    After
                </TextView>
                End
            </div>
        );
    }
}

export default App;
