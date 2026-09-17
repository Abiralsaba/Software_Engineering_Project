import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext.jsx';
import RegisterPage from '../auth/RegisterPage.jsx';
import AssistantPanel from './AssistantPanel.jsx';
vi.mock('../../utils/alerts.js',()=>({alerts:{success:vi.fn(),error:vi.fn()}}));
const response=data=>({ok:true,status:200,headers:new Headers({'content-type':'application/json'}),json:async()=>data});
describe('Applicant and accessible assistant UI',()=>{
  it('registration defaults to NID holder and removes the NID field for applicants',async()=>{
    render(<MemoryRouter><AuthProvider><RegisterPage /></AuthProvider></MemoryRouter>);
    expect(screen.getByRole('group',{name:'Choose how you want to register'})).toBeVisible();
    expect(screen.getByLabelText('NID Number')).toBeRequired();
    await userEvent.click(screen.getByRole('radio',{name:/I don’t have an NID/}));
    expect(screen.queryByLabelText('NID Number')).not.toBeInTheDocument();
    expect(screen.getByText('Applicant access')).toBeVisible();
    expect(screen.getByRole('button',{name:'Create Applicant Account'})).toBeVisible();
  });
  it('text is not sent until explicitly confirmed and microphone failure preserves text',async()=>{
    const fetch=vi.fn().mockResolvedValue(response({session_id:'synthetic-session',state:'NEW',action:'ASK_QUESTION',message_en:'Start an application?',message_bn:'আবেদন করবেন?'}));vi.stubGlobal('fetch',fetch);
    render(<AssistantPanel accountKey="ui-test" />);
    const text=screen.getByLabelText('Transcript / typed message');
    await userEvent.type(text,'Amar NID banai dao');expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button',{name:'● Tap to speak'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone is unavailable');expect(text).toHaveValue('Amar NID banai dao');
    await userEvent.click(screen.getByRole('button',{name:'Yes — confirm and send'}));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][0]).toBe('/api/assistant/speech');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({text:'Amar NID banai dao',confirmed:true});
  });
});
