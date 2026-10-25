export type VehicleArtVariant = 'hero' | 'sage' | 'warm' | 'dark';

type MaisonVehicleArtProps = {
  label: string;
  variant: VehicleArtVariant;
};

export function MaisonVehicleArt({ label, variant }: MaisonVehicleArtProps) {
  const sizeClass = variant === 'hero' ? 'maison-vehicle-art--hero' : 'maison-vehicle-art--compact';
  const toneClass = variant === 'hero' ? '' : `maison-vehicle-art--${variant}`;
  const sequence = variant === 'hero' ? '01 / 03' : variant === 'sage' ? '02 / 03' : '03 / 03';

  return (
    <div
      role="img"
      aria-label={label}
      className={`maison-vehicle-art ${sizeClass} ${toneClass}`.trim()}
    >
      <span aria-hidden="true" className="maison-vehicle-art__frame" />
      <span aria-hidden="true" className="maison-vehicle-art__orb" />
      <span aria-hidden="true" className="maison-vehicle-art__shadow" />
      <span aria-hidden="true" className="maison-vehicle-art__body" />
      <span
        aria-hidden="true"
        className="maison-vehicle-art__wheel maison-vehicle-art__wheel--left"
      />
      <span
        aria-hidden="true"
        className="maison-vehicle-art__wheel maison-vehicle-art__wheel--right"
      />
      <span aria-hidden="true" className="maison-vehicle-art__label">
        {variant === 'hero' ? 'Studio selection' : 'Maison edit'}
      </span>
      <span aria-hidden="true" className="maison-vehicle-art__footer">
        <span>{sequence}</span>
        <span>{variant === 'hero' ? 'Drive differently' : 'Considered motion'}</span>
      </span>
    </div>
  );
}
