import { useParams } from 'react-router-dom';

export function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const upperSymbol = (symbol ?? '').toUpperCase();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-100">
        {upperSymbol || 'Action'}
      </h1>
      <p className="mt-2 text-gray-400">
        Page detail de l&apos;action. Les graphiques et l&apos;historique complet seront ajoutes dans l&apos;Epic 6.
      </p>

      <div className="card mt-8">
        <h2 className="text-lg font-semibold text-gray-100">Alerte</h2>
        <p className="mt-2 text-gray-400">
          Cette navigation est active pour ouvrir la bonne action apres clic sur une notification.
        </p>
      </div>
    </div>
  );
}
