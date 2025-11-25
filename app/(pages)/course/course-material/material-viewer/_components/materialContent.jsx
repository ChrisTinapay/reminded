const MaterialContent = (props) => {
  return (
    <>
      <div className="py-6">
        <p className="indent-10 self-stretch justify-start text-gray-800 text-base font-bold font-inter leading-6 ">
          {props.materialContent}
        </p>
      </div>
    </>
  );
};

export default MaterialContent;
