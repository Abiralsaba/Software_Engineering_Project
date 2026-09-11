import { useEffect, useState } from 'react';
export default function ApplicantDocuments({ application }) {
  const [preview,setPreview] = useState(null);
  const [error,setError] = useState('');
  useEffect(() => () => { if(preview?.url) URL.revokeObjectURL(preview.url); },[preview]);
  useEffect(() => { setPreview(null); setError(''); },[application.id]);
  async function view(document) {
    setError('');
    try {
      const response = await fetch(`/api/nid/first-time-admin/${application.id}/documents/${document.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}` } });
      if(!response.ok) throw new Error('The selected document could not be opened.');
      const blob=await response.blob();
      if(blob.type !== 'image/jpeg') throw new Error('Unexpected document format.');
      setPreview({kind:document.kind,url:URL.createObjectURL(blob)});
    } catch(e) { setError(e.message); }
  }
  return <section><h4>Private applicant documents</h4>{application.documents.map(doc=><button key={doc.id} type="button" onClick={()=>view(doc)}>View {doc.kind.replaceAll('_',' ')}</button>)}{error&&<p role="alert">{error}</p>}{preview&&<figure><img src={preview.url} alt={`Applicant ${preview.kind.replaceAll('_',' ')}`} style={{maxWidth:'100%',maxHeight:480}} /><figcaption>{preview.kind.replaceAll('_',' ')}</figcaption><button type="button" onClick={()=>setPreview(null)}>Close document</button></figure>}</section>;
}
