import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';

import { AuthControls } from './AuthControls';
import { useAuth } from './auth/AuthContext';
import {
  createVehicle,
  deleteVehicle,
  listVehicles,
  restockVehicle,
  updateVehicle,
  VehicleApiError,
  type Vehicle,
  type VehicleInput,
} from './api/vehicles';
import { navigateTo } from './navigation';

type VehicleFormValues = {
  make: string;
  model: string;
  category: string;
  price: string;
  quantityInStock: string;
};

type VehicleFormProps = {
  actionLabel: string;
  ariaLabel: string;
  error: string | null;
  isSubmitting: boolean;
  onChange: (values: VehicleFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  values: VehicleFormValues;
};

const EMPTY_FORM_VALUES: VehicleFormValues = {
  make: '',
  model: '',
  category: '',
  price: '',
  quantityInStock: '',
};

function formatPrice(price: string) {
  const amount = Number(price);

  if (!Number.isFinite(amount)) {
    return price;
  }

  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(amount);
}

function vehicleName(vehicle: Vehicle) {
  return `${vehicle.make} ${vehicle.model}`;
}

function getFormValues(vehicle: Vehicle): VehicleFormValues {
  return {
    make: vehicle.make,
    model: vehicle.model,
    category: vehicle.category,
    price: vehicle.price,
    quantityInStock: String(vehicle.quantityInStock),
  };
}

function parseVehicleForm(values: VehicleFormValues) {
  const make = values.make.trim();
  const model = values.model.trim();
  const category = values.category.trim();
  const price = Number(values.price);
  const quantityInStock = Number(values.quantityInStock);

  if (!make || !model || !category) {
    return { error: 'Make, model, and category are required.' };
  }

  if (!values.price.trim() || !Number.isFinite(price) || price < 0) {
    return { error: 'Price must be a non-negative number.' };
  }

  if (!values.quantityInStock.trim() || !Number.isInteger(quantityInStock) || quantityInStock < 0) {
    return { error: 'Stock quantity must be a non-negative integer.' };
  }

  const input: VehicleInput = {
    make,
    model,
    category,
    price,
    quantityInStock,
  };

  return { input };
}

function VehicleForm({
  actionLabel,
  ariaLabel,
  error,
  isSubmitting,
  onChange,
  onSubmit,
  values,
}: VehicleFormProps) {
  function updateField(field: keyof VehicleFormValues, event: ChangeEvent<HTMLInputElement>) {
    onChange({ ...values, [field]: event.target.value });
  }

  return (
    <form
      aria-busy={isSubmitting}
      aria-label={ariaLabel}
      className="maison-admin-form"
      noValidate
      onSubmit={onSubmit}
    >
      <div className="maison-admin-form__grid">
        <div>
          <label htmlFor={`${ariaLabel}-make`} className="maison-form-label">
            Make
          </label>
          <input
            id={`${ariaLabel}-make`}
            name="make"
            required
            type="text"
            value={values.make}
            onChange={(event) => updateField('make', event)}
            className="maison-form-input maison-form-input--compact"
          />
        </div>
        <div>
          <label htmlFor={`${ariaLabel}-model`} className="maison-form-label">
            Model
          </label>
          <input
            id={`${ariaLabel}-model`}
            name="model"
            required
            type="text"
            value={values.model}
            onChange={(event) => updateField('model', event)}
            className="maison-form-input maison-form-input--compact"
          />
        </div>
        <div>
          <label htmlFor={`${ariaLabel}-category`} className="maison-form-label">
            Category
          </label>
          <input
            id={`${ariaLabel}-category`}
            name="category"
            required
            type="text"
            value={values.category}
            onChange={(event) => updateField('category', event)}
            className="maison-form-input maison-form-input--compact"
          />
        </div>
        <div>
          <label htmlFor={`${ariaLabel}-price`} className="maison-form-label">
            Price
          </label>
          <input
            id={`${ariaLabel}-price`}
            inputMode="decimal"
            min="0"
            name="price"
            required
            step="0.01"
            type="number"
            value={values.price}
            onChange={(event) => updateField('price', event)}
            className="maison-form-input maison-form-input--compact"
          />
        </div>
        <div className="maison-admin-form__wide">
          <label htmlFor={`${ariaLabel}-quantityInStock`} className="maison-form-label">
            {ariaLabel === 'Create vehicle' ? 'Initial stock quantity' : 'Stock quantity'}
          </label>
          <input
            id={`${ariaLabel}-quantityInStock`}
            inputMode="numeric"
            min="0"
            name="quantityInStock"
            required
            step="1"
            type="number"
            value={values.quantityInStock}
            onChange={(event) => updateField('quantityInStock', event)}
            className="maison-form-input maison-form-input--compact"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="maison-feedback maison-feedback--error">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="maison-button maison-button--primary"
      >
        {isSubmitting ? 'Saving…' : actionLabel}
      </button>
    </form>
  );
}

function AdminSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="maison-admin-section">
      <div className="maison-admin-section__heading">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function AdminAccessRequiredPage() {
  return (
    <div className="maison-page maison-motion-enter">
      <main className="maison-container maison-protected-layout">
        <section className="maison-protected-card">
          <p className="maison-eyebrow">Maison Motoring / Private office</p>
          <h1 className="maison-protected-title">Admin access required.</h1>
          <p className="maison-protected-copy">
            Inventory management is reserved for verified administrators.
          </p>
          <a href="/inventory" className="maison-button maison-button--primary">
            Return to inventory
          </a>
        </section>
      </main>
    </div>
  );
}

export function AdminInventoryPage() {
  const { signOut } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createValues, setCreateValues] = useState(EMPTY_FORM_VALUES);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [editValues, setEditValues] = useState(EMPTY_FORM_VALUES);
  const [deleteVehicleTarget, setDeleteVehicleTarget] = useState<Vehicle | null>(null);
  const [restockVehicleTarget, setRestockVehicleTarget] = useState<Vehicle | null>(null);
  const [restockQuantity, setRestockQuantity] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  function handleSessionFailure(submissionError: unknown) {
    if (submissionError instanceof VehicleApiError && submissionError.status === 401) {
      signOut();
      navigateTo('/login?reason=session-expired');
      return true;
    }

    return false;
  }

  function getMutationError(submissionError: unknown, fallback: string) {
    if (handleSessionFailure(submissionError)) {
      return null;
    }

    if (submissionError instanceof VehicleApiError) {
      return submissionError.message;
    }

    return fallback;
  }

  async function refreshInventory() {
    try {
      const nextVehicles = await listVehicles();
      setVehicles(nextVehicles);
      setError(null);
    } catch (loadError) {
      if (handleSessionFailure(loadError)) {
        return;
      }

      setError(
        loadError instanceof VehicleApiError && loadError.status === 403
          ? loadError.message
          : 'Unable to load admin inventory.',
      );
    }
  }

  useEffect(() => {
    let isCurrentRequest = true;

    listVehicles()
      .then((nextVehicles) => {
        if (isCurrentRequest) {
          setVehicles(nextVehicles);
        }
      })
      .catch((loadError) => {
        if (!isCurrentRequest) {
          return;
        }

        if (handleSessionFailure(loadError)) {
          return;
        }

        setError(
          loadError instanceof VehicleApiError && loadError.status === 403
            ? loadError.message
            : 'Unable to load admin inventory.',
        );
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    const parsed = parseVehicleForm(createValues);

    if (!parsed.input) {
      setCreateError(parsed.error ?? 'Please review the vehicle details.');
      return;
    }

    setIsMutating(true);
    setFeedback(null);

    createVehicle(parsed.input)
      .then(async () => {
        setCreateValues(EMPTY_FORM_VALUES);
        setFeedback('Vehicle created.');
        await refreshInventory();
      })
      .catch((submissionError) => {
        setCreateError(getMutationError(submissionError, 'Unable to create vehicle.'));
      })
      .finally(() => setIsMutating(false));
  }

  function openEdit(vehicle: Vehicle) {
    setEditVehicle(vehicle);
    setEditValues(getFormValues(vehicle));
    setEditError(null);
    setFeedback(null);
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editVehicle) {
      return;
    }

    setEditError(null);
    const parsed = parseVehicleForm(editValues);

    if (!parsed.input) {
      setEditError(parsed.error ?? 'Please review the vehicle details.');
      return;
    }

    setIsMutating(true);
    setFeedback(null);

    updateVehicle(editVehicle.id, parsed.input)
      .then(async () => {
        setEditVehicle(null);
        setFeedback('Vehicle updated.');
        await refreshInventory();
      })
      .catch((submissionError) => {
        setEditError(getMutationError(submissionError, 'Unable to update vehicle.'));
      })
      .finally(() => setIsMutating(false));
  }

  async function handleDeleteConfirm() {
    if (!deleteVehicleTarget) {
      return;
    }

    setIsMutating(true);
    setDialogError(null);
    setFeedback(null);

    try {
      await deleteVehicle(deleteVehicleTarget.id);
      setDeleteVehicleTarget(null);
      setFeedback('Vehicle deleted.');
      await refreshInventory();
    } catch (submissionError) {
      setDialogError(getMutationError(submissionError, 'Unable to delete vehicle.'));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRestockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!restockVehicleTarget) {
      return;
    }

    const quantity = Number(restockQuantity);
    if (!restockQuantity.trim() || !Number.isSafeInteger(quantity) || quantity <= 0) {
      setDialogError('Restock quantity must be a positive integer.');
      return;
    }

    setIsMutating(true);
    setDialogError(null);
    setFeedback(null);

    try {
      await restockVehicle(restockVehicleTarget.id, quantity);
      setRestockVehicleTarget(null);
      setRestockQuantity('');
      setFeedback('Vehicle restocked.');
      await refreshInventory();
    } catch (submissionError) {
      setDialogError(getMutationError(submissionError, 'Unable to restock vehicle.'));
    } finally {
      setIsMutating(false);
    }
  }

  const totalStock = vehicles.reduce((total, currentVehicle) => {
    return total + currentVehicle.quantityInStock;
  }, 0);

  return (
    <div className="maison-page maison-motion-enter">
      <header className="maison-container maison-header">
        <a href="/inventory" aria-label="Back to public inventory" className="maison-back-link">
          <span aria-hidden="true">←</span>
          Public inventory
        </a>
        <div className="maison-page-header-meta">
          <p>Maison Motoring / Admin office</p>
          <AuthControls />
        </div>
      </header>

      <main>
        <section className="maison-container maison-section maison-admin-page">
          <div className="maison-admin-intro">
            <p className="maison-eyebrow">Maison Motoring / Private office</p>
            <h1 className="maison-admin-title">Admin inventory.</h1>
            <p className="maison-admin-copy">
              Keep the collection accurate, available, and ready for the next considered choice.
            </p>
          </div>

          <div className="maison-admin-metrics">
            <div className="maison-admin-metric maison-admin-metric--sage">
              <p className="maison-admin-metric__label">Total vehicle records</p>
              <p className="maison-admin-metric__value">
                {vehicles.length} vehicle {vehicles.length === 1 ? 'record' : 'records'}
              </p>
            </div>
            <div className="maison-admin-metric">
              <p className="maison-admin-metric__label">Total stock</p>
              <p className="maison-admin-metric__value">{totalStock} total in stock</p>
            </div>
          </div>

          <div className="maison-admin-content">
            {isLoading && (
              <div
                role="status"
                aria-label="Loading admin inventory"
                className="maison-loading-state maison-loading-state--detail"
              >
                <p className="maison-state-panel__title">Loading admin inventory…</p>
                <p className="maison-state-panel__copy">Gathering the current collection.</p>
              </div>
            )}

            {!isLoading && error && (
              <div role="alert" className="maison-state-panel maison-state-panel--error">
                <p className="maison-state-panel__title">{error}</p>
                <p className="maison-state-panel__copy">
                  No changes were made. Please try again in a moment.
                </p>
              </div>
            )}

            {!isLoading && !error && (
              <>
                {feedback && (
                  <div
                    role="status"
                    aria-label="Admin inventory update"
                    className="maison-feedback maison-feedback--success"
                  >
                    {feedback}
                  </div>
                )}

                <AdminSection title="Add a vehicle">
                  <VehicleForm
                    actionLabel="Create vehicle"
                    ariaLabel="Create vehicle"
                    error={createError}
                    isSubmitting={isMutating}
                    onChange={setCreateValues}
                    onSubmit={handleCreateSubmit}
                    values={createValues}
                  />
                </AdminSection>

                <AdminSection title="Current collection">
                  {vehicles.length === 0 ? (
                    <div
                      role="status"
                      aria-label="No vehicles in inventory"
                      className="maison-state-panel maison-state-panel--empty"
                    >
                      <p className="maison-state-panel__title">No vehicles in inventory.</p>
                      <p className="maison-state-panel__copy">
                        Create the first vehicle to begin the collection.
                      </p>
                    </div>
                  ) : (
                    <div className="maison-admin-table-wrap">
                      <table aria-label="Admin vehicle inventory" className="maison-admin-table">
                        <thead>
                          <tr>
                            <th scope="col">Vehicle</th>
                            <th scope="col">Category</th>
                            <th scope="col">Price</th>
                            <th scope="col">Stock</th>
                            <th scope="col">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vehicles.map((currentVehicle) => {
                            const name = vehicleName(currentVehicle);

                            return (
                              <tr key={currentVehicle.id} className="maison-admin-table__row">
                                <th scope="row">
                                  <a
                                    href={`/vehicles/${currentVehicle.id}`}
                                    aria-label={`View ${name}`}
                                    className="maison-admin-table__vehicle"
                                  >
                                    {name}
                                  </a>
                                </th>
                                <td className="maison-admin-table__category">
                                  {currentVehicle.category}
                                </td>
                                <td className="maison-admin-table__price">
                                  {formatPrice(currentVehicle.price)}
                                </td>
                                <td className="maison-admin-table__stock">
                                  {currentVehicle.quantityInStock} in stock
                                </td>
                                <td>
                                  <div className="maison-admin-actions">
                                    <button
                                      type="button"
                                      aria-label={`Edit ${name}`}
                                      disabled={isMutating}
                                      onClick={() => openEdit(currentVehicle)}
                                      className="maison-admin-action maison-admin-action--quiet"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Restock ${name}`}
                                      disabled={isMutating}
                                      onClick={() => {
                                        setRestockVehicleTarget(currentVehicle);
                                        setRestockQuantity('');
                                        setDialogError(null);
                                      }}
                                      className="maison-admin-action maison-admin-action--sage"
                                    >
                                      Restock
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Delete ${name}`}
                                      disabled={isMutating}
                                      onClick={() => {
                                        setDeleteVehicleTarget(currentVehicle);
                                        setDialogError(null);
                                      }}
                                      className="maison-admin-action maison-admin-action--danger"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </AdminSection>
              </>
            )}
          </div>
        </section>
      </main>

      {editVehicle && (
        <div
          role="dialog"
          aria-labelledby="edit-vehicle-title"
          aria-modal="true"
          className="maison-dialog-backdrop"
        >
          <div className="maison-dialog maison-dialog--wide">
            <div className="maison-dialog__header">
              <div>
                <p className="maison-eyebrow">Edit collection record</p>
                <h2 id="edit-vehicle-title" className="maison-dialog__title">
                  Edit vehicle
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close edit vehicle dialog"
                onClick={() => setEditVehicle(null)}
                className="maison-dialog__close"
              >
                ×
              </button>
            </div>
            <VehicleForm
              actionLabel="Save changes"
              ariaLabel="Edit vehicle"
              error={editError}
              isSubmitting={isMutating}
              onChange={setEditValues}
              onSubmit={handleEditSubmit}
              values={editValues}
            />
          </div>
        </div>
      )}

      {deleteVehicleTarget && (
        <div
          role="dialog"
          aria-labelledby="delete-vehicle-title"
          aria-modal="true"
          className="maison-dialog-backdrop"
        >
          <div className="maison-dialog">
            <p className="maison-eyebrow">Remove collection record</p>
            <h2 id="delete-vehicle-title" className="maison-dialog__title">
              Delete vehicle
            </h2>
            <p className="maison-dialog__copy">
              Delete {vehicleName(deleteVehicleTarget)}? This cannot be undone. Vehicles with
              purchase history will remain protected by the backend.
            </p>
            {dialogError && (
              <div role="alert" className="maison-feedback maison-feedback--error">
                {dialogError}
              </div>
            )}
            <div className="maison-dialog__actions">
              <button
                type="button"
                disabled={isMutating}
                onClick={() => setDeleteVehicleTarget(null)}
                className="maison-button maison-button--quiet"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={handleDeleteConfirm}
                className="maison-button maison-button--danger"
              >
                {isMutating ? 'Deleting…' : 'Confirm deletion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {restockVehicleTarget && (
        <div
          role="dialog"
          aria-labelledby="restock-vehicle-title"
          aria-modal="true"
          className="maison-dialog-backdrop"
        >
          <div className="maison-dialog">
            <p className="maison-eyebrow">Add availability</p>
            <h2 id="restock-vehicle-title" className="maison-dialog__title">
              Restock vehicle
            </h2>
            <p className="maison-dialog__copy">
              Add stock for {vehicleName(restockVehicleTarget)}. Use a positive whole number.
            </p>
            <form
              aria-label="Restock vehicle"
              className="maison-dialog__form"
              onSubmit={handleRestockSubmit}
            >
              <div>
                <label htmlFor="restock-quantity" className="maison-form-label">
                  Quantity to restock
                </label>
                <input
                  id="restock-quantity"
                  inputMode="numeric"
                  min="1"
                  required
                  step="1"
                  type="number"
                  value={restockQuantity}
                  onChange={(event) => {
                    setRestockQuantity(event.target.value);
                    setDialogError(null);
                  }}
                  className="maison-form-input maison-form-input--compact"
                />
              </div>
              {dialogError && (
                <div role="alert" className="maison-feedback maison-feedback--error">
                  {dialogError}
                </div>
              )}
              <div className="maison-dialog__actions">
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => setRestockVehicleTarget(null)}
                  className="maison-button maison-button--quiet"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="maison-button maison-button--primary"
                >
                  {isMutating ? 'Restocking…' : 'Restock vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="maison-container maison-footer">
        <span>Maison Motoring / Inventory operations, considered.</span>
        <span>Est. 2026</span>
      </footer>
    </div>
  );
}
