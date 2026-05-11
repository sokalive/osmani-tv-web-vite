import { CatalogScreen } from '../components/catalog/CatalogScreen'

export function SportsPage() {
  return (
    <div className="screen-page">
      <CatalogScreen
        title="Sports"
        subtitle="Michezo ya live na vituo vya soka"
        mode="sports"
      />
    </div>
  )
}
