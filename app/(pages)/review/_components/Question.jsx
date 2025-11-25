import AnswerCard from './answerCard';

const Question = () => {
  return (
    <>
      <div className="flex flex-col gap-8">
        <h1 className="self-stretch justify-start text-gray-800 text-2xl font-bold font-poppins leading-8">
          The scenario-based question text, which may itself be multiple lines,
          is displayed here with clarity.
        </h1>
        <AnswerCard />
        <AnswerCard />
        <AnswerCard />
        <AnswerCard />
      </div>
    </>
  );
};

export default Question;
