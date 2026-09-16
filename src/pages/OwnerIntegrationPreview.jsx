import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import apiClient from '../services/apiClient';
import IntegrationPreviewStudio from '../components/integrationPreview/IntegrationPreviewStudio';
import {canSeeIntegrationPreview} from '../components/integrationPreview/model';

export default function OwnerIntegrationPreview() {
  const [access,setAccess]=useState('loading');
  useEffect(()=>{
    let live=true;
    if (!canSeeIntegrationPreview(apiClient.getUser())) {setAccess('denied');return;}
    apiClient.get('/api/v1/integration-preview/context').then(()=>{if(live)setAccess('ready');})
      .catch(()=>{if(live)setAccess('denied');});
    return ()=>{live=false;};
  },[]);
  if(access!=='ready') return <main style={{padding:48,fontFamily:'Inter, sans-serif'}}><h1>{access==='loading'?'Ouverture de votre espace de test…':'Espace réservé'}</h1><Link to="/ceo">Retour à mon dashboard</Link></main>;
  return <IntegrationPreviewStudio validateDraft={draft=>apiClient.post('/api/v1/integration-preview/validate',draft)} />;
}
