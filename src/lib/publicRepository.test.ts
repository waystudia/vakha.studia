import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
const loadPublicClass = vi.hoisted(() => vi.fn());
vi.mock('./supabase', () => ({ supabase: { functions: { invoke } } }));
vi.mock('./repository', () => ({ getPublicClass: loadPublicClass }));

import { getPublicClass } from './publicRepository';

describe('public parent request previews', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('signs a private screenshot only inside the child order and never adds it to the catalog', async () => {
    loadPublicClass.mockResolvedValue({
      school: { name: 'Школа', city: '' },
      class: { id: 'class', name: '1А', academic_year: '', photo_session_name: 'Съёмка' },
      children: [{ id: 'child', public_name: 'Ребёнок', orders: [{ status: 'new', items: [{ id: 'custom-request-1', name: 'Индивидуальный запрос', type: 'custom', price: 0, reference_path: 'owner/class/child/screen.webp' }] }] }],
      catalog: [{ id: 'photo', name: 'Фото', description: '', short_description: '', type: 'photo', category: 'Фото', gender: 'all', price: 350, preview_url: '/photo.webp', preview_video_url: '', parent_preview_mode: 'auto' }],
    });
    invoke.mockResolvedValue({ data: { previews: { 'owner/class/child/screen.webp': 'https://signed.example/screen.webp' } }, error: null });

    const payload = await getPublicClass('token-with-more-than-thirty-two-characters');

    expect(invoke).toHaveBeenCalledWith('submit-parent-request', { body: { action: 'signPreviews', token: 'token-with-more-than-thirty-two-characters' } });
    expect(payload?.children[0].orders?.[0].items[0].preview_url).toBe('https://signed.example/screen.webp');
    expect(payload?.catalog).toHaveLength(1);
    expect(payload?.catalog[0].id).toBe('photo');
  });
});
