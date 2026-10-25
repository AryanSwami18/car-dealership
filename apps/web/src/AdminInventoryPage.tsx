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
      className="grid gap-5"
      noValidate
      onSubmit={onSubmit}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${ariaLabel}-make`} className="mb-2 block text-sm font-semibold">
            Make
          </label>
          <input
            id={`${ariaLabel}-make`}
            name="make"
            required
            type="text"
            value={values.make}
            onChange={(event) => updateField('make', event)}
            className="w-full rounded-2xl border border-[#171717]/20 bg-[#F4F1EA] px-4 py-3 outline-none transition-colors focus:border-[#E56B45]"
          />
        </div>
        <div>
          <label htmlFor={`${ariaLabel}-model`} className="mb-2 block text-sm font-semibold">
            Model
          </label>
          <input
            id={`${ariaLabel}-model`}
            name="model"
            required
            type="text"
            value={values.model}
            onChange={(event) => updateField('model', event)}
            className="w-full rounded-2xl border border-[#171717]/20 bg-[#F4F1EA] px-4 py-3 outline-none transition-colors focus:border-[#E56B45]"
          />
        </div>
        <div>
          <label htmlFor={`${ariaLabel}-category`} className="mb-2 block text-sm font-semibold">
            Category
          </label>
          <input
            id={`${ariaLabel}-category`}
            name="category"
            required
            type="text"
            value={values.category}
            onChange={(event) => updateField('category', event)}
            className="w-full rounded-2xl border border-[#171717]/20 bg-[#F4F1EA] px-4 py-3 outline-none transition-colors focus:border-[#E56B45]"
          />
        </div>
        <div>
          <label htmlFor={`${ariaLabel}-price`} className="mb-2 block text-sm font-semibold">
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
            className="w-full rounded-2xl border border-[#171717]/20 bg-[#F4F1EA] px-4 py-3 outline-none transition-colors focus:border-[#E56B45]"
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor={`${ariaLabel}-quantityInStock`}
            className="mb-2 block text-sm font-semibold"
          >
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
            className="w-full rounded-2xl border border-[#171717]/20 bg-[#F4F1EA] px-4 py-3 outline-none transition-colors focus:border-[#E56B45]"
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-[#E56B45]/45 bg-[#E56B45]/10 px-4 py-3 text-sm leading-6"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="justify-self-start rounded-full bg-[#171717] px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#F4F1EA] transition-[background-color,transform] duration-300 hover:-translate-y-1 hover:bg-[#E56B45] disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:transform-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
      >
        {isSubmitting ? 'Saving…' : actionLabel}
      </button>
    </form>
  );
}

function AdminSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-[2rem] border border-[#171717]/15 bg-white/20 p-6 sm:p-8">
      <div className="mb-7 flex flex-col gap-2 border-b border-[#171717]/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-display text-4xl tracking-[-0.05em]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function AdminAccessRequiredPage() {
  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#171717]">
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-20">
        <section className="w-full rounded-[2rem] border border-[#171717]/15 bg-white/25 px-6 py-14 text-center sm:px-12">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#E56B45]">
            Maison Motoring / Private office
          </p>
          <h1 className="font-display text-5xl tracking-[-0.06em]">Admin access required.</h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-7 text-[#171717]/65">
            Inventory management is reserved for verified administrators.
          </p>
          <a
            href="/inventory"
            className="mt-8 inline-flex rounded-full bg-[#171717] px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#F4F1EA] transition-[background-color,transform] duration-300 hover:-translate-y-1 hover:bg-[#E56B45] motion-reduce:transition-none motion-reduce:hover:transform-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
          >
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
    <div className="min-h-screen overflow-x-hidden bg-[#F4F1EA] text-[#171717]">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-6 lg:px-12">
        <a
          href="/inventory"
          aria-label="Back to public inventory"
          className="group inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
        >
          <span className="text-lg motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:-translate-x-1">
            ←
          </span>
          Public inventory
        </a>
        <div className="flex items-center gap-5">
          <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-[#171717]/55 sm:block">
            Maison Motoring / Admin office
          </span>
          <AuthControls />
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[1440px] px-6 pb-20 pt-12 lg:px-12 lg:pb-32 lg:pt-24">
          <div className="max-w-3xl">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#E56B45]">
              Maison Motoring / Private office
            </p>
            <h1 className="font-display text-[clamp(3.5rem,8vw,7rem)] leading-[0.88] tracking-[-0.07em]">
              Admin inventory.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[#171717]/65">
              Keep the collection accurate, available, and ready for the next considered choice.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-[#171717]/15 bg-[#A8B5A0]/35 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#171717]/55">
                Total vehicle records
              </p>
              <p className="mt-3 font-display text-5xl tracking-[-0.06em]">
                {vehicles.length} vehicle {vehicles.length === 1 ? 'record' : 'records'}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[#171717]/15 bg-white/25 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#171717]/55">
                Total stock
              </p>
              <p className="mt-3 font-display text-5xl tracking-[-0.06em]">
                {totalStock} total in stock
              </p>
            </div>
          </div>

          <div className="mt-12 space-y-6">
            {isLoading && (
              <div role="status" aria-label="Loading admin inventory" className="py-24 text-center">
                <p className="font-display text-4xl tracking-[-0.05em]">Loading admin inventory…</p>
                <p className="mt-3 text-sm text-[#171717]/55">Gathering the current collection.</p>
              </div>
            )}

            {!isLoading && error && (
              <div
                role="alert"
                className="rounded-[2rem] border border-[#E56B45]/45 bg-[#E56B45]/10 px-6 py-12 sm:px-10"
              >
                <p className="font-display text-4xl tracking-[-0.05em]">{error}</p>
                <p className="mt-3 max-w-lg text-sm leading-6 text-[#171717]/65">
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
                    className="rounded-2xl border border-[#A8B5A0] bg-[#A8B5A0]/25 px-4 py-3 text-sm leading-6"
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
                      className="rounded-2xl border border-dashed border-[#171717]/25 px-6 py-12 text-center"
                    >
                      <p className="font-display text-3xl tracking-[-0.05em]">
                        No vehicles in inventory.
                      </p>
                      <p className="mt-3 text-sm text-[#171717]/60">
                        Create the first vehicle to begin the collection.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table aria-label="Admin vehicle inventory" className="w-full min-w-[760px]">
                        <thead>
                          <tr className="border-b border-[#171717]/15 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55">
                            <th className="px-3 pb-4" scope="col">
                              Vehicle
                            </th>
                            <th className="px-3 pb-4" scope="col">
                              Category
                            </th>
                            <th className="px-3 pb-4" scope="col">
                              Price
                            </th>
                            <th className="px-3 pb-4" scope="col">
                              Stock
                            </th>
                            <th className="px-3 pb-4" scope="col">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {vehicles.map((currentVehicle) => {
                            const name = vehicleName(currentVehicle);

                            return (
                              <tr
                                key={currentVehicle.id}
                                className="border-b border-[#171717]/10 last:border-0"
                              >
                                <th className="px-3 py-5 text-left" scope="row">
                                  <a
                                    href={`/vehicles/${currentVehicle.id}`}
                                    aria-label={`View ${name}`}
                                    className="font-display text-2xl tracking-[-0.04em] underline decoration-[#E56B45] decoration-2 underline-offset-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
                                  >
                                    {name}
                                  </a>
                                </th>
                                <td className="px-3 py-5 text-sm uppercase tracking-[0.12em] text-[#171717]/60">
                                  {currentVehicle.category}
                                </td>
                                <td className="px-3 py-5 text-sm font-semibold">
                                  {formatPrice(currentVehicle.price)}
                                </td>
                                <td className="px-3 py-5 text-sm font-semibold">
                                  {currentVehicle.quantityInStock} in stock
                                </td>
                                <td className="px-3 py-5">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      aria-label={`Edit ${name}`}
                                      disabled={isMutating}
                                      onClick={() => openEdit(currentVehicle)}
                                      className="rounded-full border border-[#171717]/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-colors hover:border-[#171717] hover:bg-[#171717] hover:text-[#F4F1EA] disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E56B45]"
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
                                      className="rounded-full border border-[#171717]/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-colors hover:border-[#171717] hover:bg-[#A8B5A0] disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E56B45]"
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
                                      className="rounded-full border border-[#E56B45]/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#E56B45] transition-colors hover:bg-[#E56B45] hover:text-[#F4F1EA] disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E56B45]"
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
          className="fixed inset-0 z-10 flex items-center justify-center overflow-y-auto bg-[#171717]/55 px-6 py-8"
        >
          <div className="w-full max-w-2xl rounded-[2rem] bg-[#F4F1EA] p-6 text-[#171717] shadow-2xl sm:p-8">
            <div className="mb-8 flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E56B45]">
                  Edit collection record
                </p>
                <h2
                  id="edit-vehicle-title"
                  className="mt-3 font-display text-4xl tracking-[-0.05em]"
                >
                  Edit vehicle
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close edit vehicle dialog"
                onClick={() => setEditVehicle(null)}
                className="rounded-full border border-[#171717]/20 px-3 py-2 text-lg leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E56B45]"
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
          className="fixed inset-0 z-10 flex items-center justify-center bg-[#171717]/55 px-6 py-8"
        >
          <div className="w-full max-w-lg rounded-[2rem] bg-[#F4F1EA] p-6 text-[#171717] shadow-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E56B45]">
              Remove collection record
            </p>
            <h2 id="delete-vehicle-title" className="mt-3 font-display text-4xl tracking-[-0.05em]">
              Delete vehicle
            </h2>
            <p className="mt-5 text-sm leading-6 text-[#171717]/65">
              Delete {vehicleName(deleteVehicleTarget)}? This cannot be undone. Vehicles with
              purchase history will remain protected by the backend.
            </p>
            {dialogError && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-[#E56B45]/45 bg-[#E56B45]/10 px-4 py-3 text-sm leading-6"
              >
                {dialogError}
              </div>
            )}
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isMutating}
                onClick={() => setDeleteVehicleTarget(null)}
                className="rounded-full border border-[#171717]/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-[#171717] hover:bg-[#171717] hover:text-[#F4F1EA] disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E56B45]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={handleDeleteConfirm}
                className="rounded-full bg-[#E56B45] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#F4F1EA] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#171717] disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:transform-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E56B45]"
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
          className="fixed inset-0 z-10 flex items-center justify-center bg-[#171717]/55 px-6 py-8"
        >
          <div className="w-full max-w-lg rounded-[2rem] bg-[#F4F1EA] p-6 text-[#171717] shadow-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E56B45]">
              Add availability
            </p>
            <h2
              id="restock-vehicle-title"
              className="mt-3 font-display text-4xl tracking-[-0.05em]"
            >
              Restock vehicle
            </h2>
            <p className="mt-5 text-sm leading-6 text-[#171717]/65">
              Add stock for {vehicleName(restockVehicleTarget)}. Use a positive whole number.
            </p>
            <form
              aria-label="Restock vehicle"
              className="mt-8 space-y-5"
              onSubmit={handleRestockSubmit}
            >
              <div>
                <label htmlFor="restock-quantity" className="mb-2 block text-sm font-semibold">
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
                  className="w-full rounded-2xl border border-[#171717]/20 bg-[#F4F1EA] px-4 py-3 outline-none transition-colors focus:border-[#E56B45]"
                />
              </div>
              {dialogError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-[#E56B45]/45 bg-[#E56B45]/10 px-4 py-3 text-sm leading-6"
                >
                  {dialogError}
                </div>
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => setRestockVehicleTarget(null)}
                  className="rounded-full border border-[#171717]/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-[#171717] hover:bg-[#171717] hover:text-[#F4F1EA] disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E56B45]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="rounded-full bg-[#171717] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#F4F1EA] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#E56B45] disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:transform-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E56B45]"
                >
                  {isMutating ? 'Restocking…' : 'Restock vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="mx-auto max-w-[1440px] border-t border-[#171717]/15 px-6 py-8 text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/55 lg:px-12">
        Maison Motoring / Inventory operations, considered.
      </footer>
    </div>
  );
}
