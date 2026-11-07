import { useEffect, useState } from 'react';
import { getProfile } from '../lib/repository';
import { PublicCatalogPage } from './PublicCatalogPage';
import { Loader, Notice } from '../components/ui';
import { Link, Navigate } from 'react-router-dom';
import { humanError } from '../lib/helpers';

export function AdminCatalogViewPage({userId, presentation = false}: {userId: string; presentation?: boolean}) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { let alive = true; void getProfile(userId).then(profile => { if (alive) setToken(profile.public_catalog_token); }).catch(reason => { if (alive) setError(humanError(reason)); }); return () => { alive = false; }; }, [userId]);
  if (error) return <main className="public-page"><Notice kind="error">{error}</Notice><Link to="/admin/catalog">В админку</Link></main>;
  if (!token) return <Loader label="Открываем каталог…" />;
  if (!presentation) return <Navigate to={`/catalog/${token}`} replace />;
  return <PublicCatalogPage key={`${token}-${presentation}`} catalogToken={token} presentation internal />;
}
