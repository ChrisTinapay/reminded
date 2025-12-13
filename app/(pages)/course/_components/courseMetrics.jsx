import ProgressBar from './progressBar';

const CourseMetrics = () => {
  return (
    <>
      <div className="w-80 p-6 flex flex-col justify-start items-center gap-4 rounded-xl shadow-lg inset-shadow-sm">
        <h1 className="self-stretch justify-start text-center text-2xl font-bold text-gray-800 font-poppins leading-6">
          Mastery:
        </h1>
        <ProgressBar pct={Math.min(100, Math.max(0, 1))} />
        <h1 className="self-stretch justify-start text-gray-800 text-base font-bold font-inter leading-6">
          Questions reviewed: 250/500
        </h1>
      </div>
    </>
  );
};

export default CourseMetrics;
