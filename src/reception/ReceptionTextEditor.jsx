import { createPortal } from 'react-dom';
import { useCallback, useState } from 'react';
import ArticleEditor from '../text/ArticleEditor.jsx';
import { TextToolsContent } from '../text/TextTools.jsx';
import TextColourTools from '../text/TextColourTools.jsx';
import useTextEditSession from '../text/useTextEditSession.js';
import { saveReceptionTextResult } from './receptionSession.js';

const articleOf = record => record.article;
export default function ReceptionTextEditor({ record, store, toolsHost }) {
  const [controls, setControls] = useState(null), [editor, setEditor] = useState(null), [section, setSection] = useState('format');
  const [colourTarget, setColourTarget] = useState('default'), [preview, setPreview] = useState(null);
  const edit = useTextEditSession({ store, scope: { profile: store.getProfileAddress(), id: record.id }, record, valueOf: articleOf, saveRecord: saveReceptionTextResult });
  const change = useCallback(article => edit.session.save(article), [edit.session]);
  return <div className="reception-text">
    <ArticleEditor article={preview || edit.value} onChange={change} onEditor={setEditor} controlsHost={controls} containerOwned sharedColour onRevealFormatting={setSection} saveError={edit.error} />
    {toolsHost && createPortal(<>
      <TextToolsContent article={edit.value} onChange={change} targetId={record.id} controlsRef={setControls} sharedColour containerControls={false}
        section={section} onSectionChange={setSection} recoveryPending={edit.failed} footer={edit.failed ? <p role="alert">{edit.error}
          <button type="button" className="workflow-tactile-control" onClick={() => edit.session.save(edit.value, { retry: true })}>Retry saving Text</button>
          {edit.reason === 'conflict' && <button type="button" className="workflow-tactile-control" onClick={() => edit.session.save(edit.value, { retry: true, replace: true })}>Replace saved Text with these edits</button>}</p> : <p role="status">Text saved locally</p>} />
      <details><summary>Text color</summary><TextColourTools article={edit.value} editor={editor} target={colourTarget} onTarget={setColourTarget}
        onChange={change} onPreview={setPreview} store={store} containerControls={false} /></details>
    </>, toolsHost)}
  </div>;
}
