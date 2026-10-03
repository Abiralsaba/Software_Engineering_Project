import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NidCardPreview } from './MinistryPresentation.jsx';

describe('NID card data', () => {
  it('renders the saved parent names and citizen photo from the profile API', () => {
    render(<NidCardPreview profile={{ name_en: 'Example Citizen', father_name_bn: 'পিতার নাম', mother_name_en: 'Example Mother', photo_url: 'uploads/example.png', nid_number: '1234567890', profile_status: 'Active' }} />);
    expect(screen.getByText('পিতার নাম')).toBeVisible();
    expect(screen.getByText('Example Mother')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Citizen portrait' })).toHaveAttribute('src', '/uploads/example.png');
    expect(screen.getByText('NID: 1234567890')).toBeVisible();
    expect(screen.getByText('Status: Active')).toBeVisible();
  });
  it('labels registration-only data as incomplete without inventing identity details', () => {
    render(<NidCardPreview profile={{ name_en: 'Example Citizen', has_full_profile: false }} />);
    expect(screen.getByText('Status: Profile incomplete')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/Complete My NID Profile/)).toBeVisible();
  });
  it('handles a missing profile while a request is unavailable', () => {
    render(<NidCardPreview profile={null} />);
    expect(screen.getByText('NID: —')).toBeVisible();
  });
});
