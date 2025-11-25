const ProgressBar = (props) => {
  return (
    <>
      <div className="flex flex-col justify-start items-center gap-1 w-80 px-6">
        <div className="self-stretch flex justify-between">
          <h1 className="self-stretch justify-start text-gray-800 text-base font-bold font-inter leading-6">
            Progress
          </h1>
          <h1 className="self-stretch justify-start text-gray-800 text-base font-bold font-inter leading-6t">
            {props.pct}%
          </h1>
        </div>
        <div className="h-3 rounded-full bg-purple-600/25 self-stretch">
          <div
            className="bg-purple-600 h-3 rounded-full"
            style={{ width: `${props.pct}%` }}
          ></div>
        </div>
      </div>
    </>
  );
};

export default ProgressBar;
