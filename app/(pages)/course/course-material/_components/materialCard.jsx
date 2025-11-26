const MaterialCard = (props) => {
  return (
    <>
      <button className="h-26 w-sm p-4 flex rounded-xl shadow-lg inset-shadow-sm  items-center gap-4 sm:">
        <div>
          <h1 className="line-clamp-2 text-start self-stretch text-gray-800 text-base font-bold font-inter leading-6">
            {props.course}
          </h1>
        </div>
        <h1 className="justify-start text-gray-800 text-base font-bold font-inter leading-6">
          &gt;
        </h1>
      </button>
    </>
  );
};

export default MaterialCard;
