export const inr = (value: unknown) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))

export const inrShort = (value: unknown) => {
  const amount = Number(value || 0)
  if (Math.abs(amount) >= 1e7) return `₹${(amount / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`
  if (Math.abs(amount) >= 1e5) return `₹${(amount / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`
  return inr(amount)
}
