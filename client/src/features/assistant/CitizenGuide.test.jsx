import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import CitizenGuide from './CitizenGuide.jsx';

vi.mock('./useSpeech.js', () => ({ useSpeech: () => ({ available: true, speaking: false, error: '', speak: vi.fn(), stop: vi.fn() }) }));
const voiceHandlers = vi.hoisted(() => ({ onTranscript: null }));
vi.mock('./useVoiceInput.js', () => ({ useVoiceInput: ({ onTranscript }) => { voiceHandlers.onTranscript = onTranscript; return { state: 'idle', toggle: vi.fn(), cancel: vi.fn() }; } }));

beforeEach(() => { sessionStorage.clear(); sessionStorage.setItem('nationx-guide-preferences', JSON.stringify({ language: 'en', spoken: false })); });
afterEach(() => { document.body.innerHTML = ''; });

describe('shared ministry assistant choices', () => {
  it.each([
    ['agriculture', 'crop-reports', 'Season', ['Aus', 'Aman', 'Boro'], 'Aman'],
    ['nid', 'profile', 'Gender', ['Male', 'Female', 'Other'], 'Female'],
    ['passport', 'apply', 'Passport type', ['Ordinary', 'Official'], 'Official'],
  ])('fills the live %s form when the user taps a dropdown choice', async (ministry, section, label, choices, choice) => {
    const form = document.createElement('form');
    const select = document.createElement('select');
    select.name = label.toLowerCase().replaceAll(' ', '_');
    select.required = true;
    select.innerHTML = `<option value="">Select</option>${choices.map(value => `<option>${value}</option>`).join('')}`;
    const wrapper = document.createElement('label');
    wrapper.append(label, select);
    form.append(wrapper);
    form.getClientRects = () => [{}];
    const main = document.createElement('main');
    main.append(form);
    document.body.append(main);

    render(<MemoryRouter><CitizenGuide ministry={ministry} activeSection={section} onSectionChange={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Help with this service/i }));
    fireEvent.click(screen.getByRole('button', { name: /Guide me step by step/i }));
    const options = await screen.findByRole('group', { name: `${label} options` });
    fireEvent.click(options.querySelectorAll('button')[choices.indexOf(choice)]);
    await waitFor(() => expect(select.value).toBe(choice));
  });
  it('waits for dependent district and upazila choices instead of ending guidance after division', async () => {
    const rects = vi.spyOn(HTMLFormElement.prototype, 'getClientRects').mockReturnValue([{}]);
    function LocationForm() {
      const [division, setDivision] = useState('');
      const [districts, setDistricts] = useState([]);
      const [district, setDistrict] = useState('');
      const [upazilas, setUpazilas] = useState([]);
      return <main><form>
        <label>Division<select name='division_id' value={division} onChange={event => {
          setDivision(event.target.value);
          setTimeout(() => setDistricts(['Dhaka', 'Cumilla']), 20);
        }}><option value=''>Select division</option><option>Dhaka</option></select></label>
        <label>District<select name='district_id' value={district} disabled={!districts.length} onChange={event => {
          setDistrict(event.target.value);
          setTimeout(() => setUpazilas(['Savar', 'Dhamrai']), 20);
        }}><option value=''>Select district</option>{districts.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Upazila<select name='upazila_id' disabled={!upazilas.length} defaultValue=''><option value=''>Select upazila</option>{upazilas.map(value => <option key={value}>{value}</option>)}</select></label>
      </form></main>;
    }
    try {
      render(<MemoryRouter><LocationForm /><CitizenGuide ministry='agriculture' activeSection='crop-reports' onSectionChange={vi.fn()} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: /Help with this service/i }));
      fireEvent.click(screen.getByRole('button', { name: /Guide me step by step/i }));
      fireEvent.click((await screen.findByRole('group', { name: 'Division options' })).querySelector('button'));
      expect(screen.getByText(/Choices are still loading/i)).toBeTruthy();
      fireEvent.click((await screen.findByRole('group', { name: 'District options' })).querySelectorAll('button')[0]);
      expect((await screen.findByRole('group', { name: 'Upazila options' })).querySelectorAll('button')).toHaveLength(2);
    } finally { rects.mockRestore(); }
  });
  it('does not present a random sentence as a number, but lets the user confirm a clear spoken number', async () => {
    const form = document.createElement('form');
    form.innerHTML = '<label>Land area acres<input type="number" name="land_area_acres" min="0" step="0.01"></label>';
    form.getClientRects = () => [{}];
    const main = document.createElement('main'); main.append(form); document.body.append(main);
    render(<MemoryRouter><CitizenGuide ministry='agriculture' activeSection='crop-reports' onSectionChange={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Help with this service/i }));
    fireEvent.click(screen.getByRole('button', { name: /Guide me step by step/i }));
    await screen.findByText(/Enter land area acres as a number/i);
    act(() => voiceHandlers.onTranscript('নিজের স্ত্রীর স্বাস্থ্যের সাথে সংযোগ প্রদান করি'));
    expect(screen.getByRole('alert').textContent).toMatch(/clear number/i);
    expect(screen.getByRole('textbox', { name: 'Land area acres' }).value).toBe('');
    act(() => voiceHandlers.onTranscript('দশ'));
    expect(screen.getByRole('textbox', { name: 'Land area acres' }).value).toBe('দশ');
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));
    await waitFor(() => expect(form.elements.land_area_acres.value).toBe('10'));
  });
  it('submits the original validated form when the user says a submit command at final review', async () => {
    const submitted = vi.fn(event => event.preventDefault());
    const closed = vi.fn();
    const form = document.createElement('form');
    form.innerHTML = '<label>Farmer name<input name="farmer_name" required value="Abir"></label><button type="submit">Submit crop report</button>';
    form.addEventListener('submit', submitted);
    form.getClientRects = () => [{}];
    const main = document.createElement('main'); main.append(form); document.body.append(main);
    render(<MemoryRouter><CitizenGuide ministry='agriculture' activeSection='crop-reports' onSectionChange={vi.fn()} onClose={closed} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Help with this service/i }));
    fireEvent.click(screen.getByRole('button', { name: /Guide me step by step/i }));
    await screen.findByText(/Say “submit” when it is correct/i);
    act(() => voiceHandlers.onTranscript('জমা দাও'));
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
  });
  it('does not submit an invalid reviewed form and returns to the missing field', async () => {
    const submitted = vi.fn(event => event.preventDefault());
    const form = document.createElement('form');
    form.innerHTML = '<label>Farmer name<input name="farmer_name" required></label><button type="submit">Submit crop report</button>';
    form.addEventListener('submit', submitted);
    form.getClientRects = () => [{}];
    const main = document.createElement('main'); main.append(form); document.body.append(main);
    render(<MemoryRouter><CitizenGuide ministry='agriculture' activeSection='crop-reports' onSectionChange={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Help with this service/i }));
    fireEvent.click(screen.getByRole('button', { name: /Guide me step by step/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Review details/i }));
    await screen.findByText(/Say “submit” when it is correct/i);
    act(() => voiceHandlers.onTranscript('submit'));
    expect(submitted).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
