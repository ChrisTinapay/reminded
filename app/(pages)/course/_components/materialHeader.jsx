const MaterialHeader = (props) => {
  return (
    <>
      <div className="flex items-center gap-6 py-8">
        <button className="px-4 text-center justify-start text-gray-800 text-base font-bold font-poppins leading-6">
          &lt;
        </button>
        <div className="w-full flex justify-center items-center">
          <h1 className="text-center justify-start text-gray-800/75 text-base font-bold font-poppins leading-6">
            {props.pageName}
          </h1>
        </div>
      </div>
    </>
  );
};

export default MaterialHeader;
