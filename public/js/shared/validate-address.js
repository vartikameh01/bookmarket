// used by checkout and the profile page in the browser, and by the orders route on the server
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const TEXT_FIELDS = [
  ['name', 'Enter the name to deliver to', 80],
  ['line1', 'Enter the house number and street', 120],
  ['line2', null, 120],
  ['city', 'Enter the city', 60],
];

/** Returns { value, errors } where value is a clean address ready to store. */
export function validateAddress(input = {}) {
  const value = {};
  const errors = {};

  for (const [field, missing, max] of TEXT_FIELDS) {
    const text = String(input[field] ?? '').trim().replace(/\s+/g, ' ');
    if (!text && missing) {
      errors[field] = missing;
    } else if (text.length > max) {
      errors[field] = `Keep this under ${max} characters`;
    } else {
      value[field] = text;
    }
  }

  // people type numbers like "+91 98765 43210" or "098765 43210", so drop the country code and trunk zero
  const phone = String(input.phone ?? '').replace(/[\s()-]/g, '').replace(/^(\+91|91(?=\d{10}$)|0(?=\d{10}$))/, '');
  if (!/^[6-9]\d{9}$/.test(phone)) {
    errors.phone = 'Enter a 10 digit mobile number';
  } else {
    value.phone = phone;
  }

  const state = String(input.state ?? '').trim();
  if (!INDIAN_STATES.includes(state)) {
    errors.state = 'Pick a state';
  } else {
    value.state = state;
  }

  // indian pincodes are six digits and never start with 0
  const pincode = String(input.pincode ?? '').replace(/\s/g, '');
  if (!/^[1-9]\d{5}$/.test(pincode)) {
    errors.pincode = 'Enter a 6 digit pincode';
  } else {
    value.pincode = pincode;
  }

  return { value, errors };
}
