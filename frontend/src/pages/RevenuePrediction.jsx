import { useState } from "react";
import api from "../services/api";

export default function RevenuePrediction() {
  const [formData, setFormData] = useState({
    category: "",
    region: "",
    seasonality: "",
    demand: "",
    price: "",
    promotion: "",
  });

  const [predictedRevenue, setPredictedRevenue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handlePredict = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");
    setPredictedRevenue(null);

    try {
      const response = await api.post("/revenue/predict", {
        category: formData.category,
        region: formData.region,
        seasonality: formData.seasonality,
        demand: Number(formData.demand),
        price: Number(formData.price),
        promotion: formData.promotion,
      });

      setPredictedRevenue(response.data.predicted_revenue);
    } catch (err) {
      console.error(err);
      setError("Unable to predict revenue. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8">

      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 p-7 md:p-9 mb-8 text-white shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">
              ₹
            </div>

            <div>
              <h1 className="text-3xl font-bold">
                Revenue Prediction
              </h1>
              <p className="text-indigo-100 mt-1">
                AI-powered business revenue forecasting
              </p>
            </div>
          </div>

          <p className="text-sm text-indigo-100 max-w-xl mt-4">
            Analyze your business inputs and get an instant revenue prediction
            using our trained machine learning model.
          </p>
        </div>

        {/* Decorative circles */}
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10"></div>
        <div className="absolute right-24 -bottom-16 w-48 h-48 rounded-full bg-white/10"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-7">

        {/* Left Form Section */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">

          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-xl">
              📋
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Prediction Details
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Provide your business information below
              </p>
            </div>
          </div>

          <form onSubmit={handlePredict} className="space-y-5">

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Product Category
              </label>

              <input
                type="text"
                name="category"
                placeholder="e.g. Electronics"
                value={formData.category}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>

            {/* Region + Seasonality */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Region
                </label>

                <input
                  type="text"
                  name="region"
                  placeholder="e.g. South"
                  value={formData.region}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Seasonality
                </label>

                <input
                  type="text"
                  name="seasonality"
                  placeholder="e.g. Summer"
                  value={formData.seasonality}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            {/* Demand + Price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Expected Demand
                </label>

                <input
                  type="number"
                  name="demand"
                  placeholder="e.g. 500"
                  value={formData.demand}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Product Price (₹)
                </label>

                <input
                  type="number"
                  name="price"
                  placeholder="e.g. 2500"
                  value={formData.price}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            {/* Promotion */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Promotion Active?
              </label>

              <select
                name="promotion"
                value={formData.promotion}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              >
                <option value="">Select an option</option>
                <option value="Yes">Yes, promotion is active</option>
                <option value="No">No promotion</option>
              </select>
            </div>

            {/* Predict Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Analyzing Business Data..." : "✦ Predict Revenue"}
            </button>
          </form>
        </div>

        {/* Right Side */}
        <div className="lg:col-span-2 space-y-6">

          {/* AI Result Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 p-7 text-white shadow-lg">

            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-indigo-200">
                  AI REVENUE FORECAST
                </p>

                <span className="px-3 py-1 rounded-full bg-white/10 text-xs text-indigo-100">
                  ML Model
                </span>
              </div>

              {predictedRevenue !== null ? (
                <>
                  <p className="text-xs text-slate-300 mt-7">
                    Predicted Revenue
                  </p>

                  <h2 className="text-4xl md:text-5xl font-bold mt-2 tracking-tight">
                    ₹{predictedRevenue.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </h2>

                  <div className="mt-6 pt-5 border-t border-white/10">
                    <p className="text-sm text-indigo-200">
                      ✓ Prediction generated successfully
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-10 mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">
                      ✦
                    </div>

                    <h2 className="text-2xl font-bold mt-5">
                      Ready to analyze
                    </h2>

                    <p className="text-sm text-indigo-200 mt-3 leading-relaxed">
                      Enter your business details and let our AI model estimate
                      your expected revenue.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="absolute -right-16 -bottom-16 w-48 h-48 rounded-full bg-indigo-500/20"></div>
            <div className="absolute -right-5 top-8 w-20 h-20 rounded-full bg-purple-400/10"></div>
          </div>

          {/* How It Works */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                ✨
              </div>

              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                How it works
              </h3>
            </div>

            <div className="space-y-4">
              {[
                ["01", "Enter your business details"],
                ["02", "Data is sent to the AI model"],
                ["03", "ML model analyzes the inputs"],
                ["04", "Get your revenue prediction"],
              ].map(([number, text]) => (
                <div key={number} className="flex items-center gap-3">
                  <span className="w-8 h-8 shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">
                    {number}
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900 p-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
