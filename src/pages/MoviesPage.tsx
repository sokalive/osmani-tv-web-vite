import { CatalogScreen } from '../components/catalog/CatalogScreen'

export function MoviesPage() {
  return (
    <div className="screen-page">
      <CatalogScreen
        title="Tamthilia"
        subtitle="Movies, tamthilia na vituo vya burudani"
        mode="movies"
      />
    </div>
  )
}
