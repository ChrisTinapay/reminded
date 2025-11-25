const CourseHeader = () => {
  return (
    <>
      <div className="flex justify-between items-center gap-6 self-stretch">
        <button className="text-center justify-start text-gray-800 text-base font-bold font-poppins leading-6">
          &lt; Back
        </button>
        <h1 className="self-stretch justify-start text-gray-800/75 text-base font-bold font-poppins leading-6 line-clamp-1">
          CS102: Introduction to Computing
        </h1>
      </div>
    </>
  );
};

export default CourseHeader;
