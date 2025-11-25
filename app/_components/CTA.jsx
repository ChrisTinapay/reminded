const CTA = (props) => {
  return (
    <>
      <button
        onClick={props.onClick}
        className={`text-base text-center justify-start font-bold font-poppins leading-6 flex-center py-2 px-6 rounded-xl ${props.styles}`}
      >
        {props.text}
      </button>
    </>
  );
};

export default CTA;
