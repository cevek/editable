import * as React from 'react';
import * as ReactDOM from 'react-dom';
import registerServiceWorker from './registerServiceWorker';
import './index.css';
import { Example, ExampleWrap } from './Editor';

ReactDOM.render(
    <ExampleWrap/>,
    document.getElementById('root') as HTMLElement
);
registerServiceWorker();
