import CTA from '@/app/_components/CTA';

const CourseCTAContainer = () => {
  return (
    <>
      <CTA styles="w-80 text-gray-50 bg-purple-600 " text="Start Review" />
      <button className="w-80 flex justify-between items-center py-4">
        <h1 className="justify-start text-gray-800 text-base font-bold underline leading-6 font-poppins">
          View Course Material
        </h1>
        <h1 className="justify-start text-gray-800 text-base font-bold leading-6 font-poppins">
          &gt;
        </h1>
      </button>
    </>
  );
};

export default CourseCTAContainer;
