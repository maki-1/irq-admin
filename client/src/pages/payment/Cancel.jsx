import { Link } from 'react-router-dom';
import { MdCancel } from 'react-icons/md';

export default function PaymentCancel() {
  return (
    <div className="min-h-screen bg-mint flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="w-24 h-24 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <MdCancel size={56} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-800 mb-2">Payment Cancelled</h1>
        <p className="text-gray-500 text-sm mb-8">
          Your payment was not completed. No charges were made. You can try again anytime.
        </p>
        <Link to="/requests" className="btn-primary inline-block">
          Back to My Requests
        </Link>
        <div className="mt-4">
          <Link to="/dashboard" className="text-sm text-primary hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
